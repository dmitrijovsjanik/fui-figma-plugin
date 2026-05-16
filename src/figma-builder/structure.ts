// Neutral, in-memory representation of the variable structure (collections + variables).
// Single source of truth for both:
//   - DTCG JSON serialization (legacy / future)
//   - Direct figma.variables.* materialization (apply.ts)
//
// Build it once via buildVariableStructure(input, semanticNaming, namingConfig, semanticConfig),
// then consume.

import type {
  Palette,
  AlphaPalette,
  SecondaryConfig,
  SemanticRole,
  StepIndex,
  AlphaColor,
  NamingConfig,
  SemanticConfig,
  PrimitiveRef,
} from '../palette-core';
import {
  STEP_INDICES,
  SEMANTIC_ROLES,
  applyRoleToRef,
  roleScaleName,
} from '../palette-core';
import type { SemanticNamingConfig } from '../ui/persistence-types';

export type RGBA = { r: number; g: number; b: number; a: number };

export interface VariableSpec {
  // Stable identity that survives renames. Format:
  //   primitives: 'prim:<theme>:<role>:<solid|alpha>:<step>'
  //   primitives (special): 'prim:<theme>:gray-bg' / 'prim:black-a:<step>' / 'prim:white-fixed'
  //   semantics:  'sem:<token-id>' where token-id is the StandaloneToken/RoleSlot UUID
  //               (slots additionally suffix ':<role>' so each expansion is distinct)
  // Used to look up the corresponding Figma Variable by ID across syncs, so
  // user-visible name changes don't cause spurious recreations.
  key: string;
  // Path components, e.g. ['light', 'gray', '0'] or ['bg', 'canvas']
  path: string[];
  // Native Figma variable description. Populated for semantic tokens only;
  // primitives leave it empty (their meaning is encoded by step + role).
  description?: string;
  // Per-mode value: either a literal RGBA, or an alias to another variable.
  // Alias is expressed as { aliasOf: { collection, path } } — collection is the
  // human-readable collection name (e.g. 'primitives'), path is the target var path.
  valuesByMode: Record<string, RGBA | { aliasOf: { collection: string; path: string[] } }>;
}

export interface CollectionSpec {
  name: string;
  modes: string[];
  variables: VariableSpec[];
}

export interface VariableStructure {
  primitives: CollectionSpec;
  semantics: CollectionSpec;
}

export interface FigmaTokensInput {
  light: { palette: Palette; alphaPalette?: AlphaPalette; backgroundColor: string };
  dark: { palette: Palette; alphaPalette?: AlphaPalette; backgroundColor: string };
  secondary?: SecondaryConfig;
}

export const PRIMITIVES = 'primitives';
export const SEMANTICS = 'semantics';

const ROLE_TO_SCALE: ReadonlyArray<[SemanticRole, string]> = [
  ['brand', 'accent'],
  ['neutral', 'gray'],
  ['success', 'green'],
  ['warning', 'amber'],
  ['danger', 'red'],
  ['info', 'blue'],
];

// Pure-black alpha scale (Radix `blackA`). Theme-invariant. Floats 0-1.
const BLACK_ALPHA: Record<StepIndex, number> = {
  1: 0.012, 2: 0.024, 3: 0.05, 4: 0.075, 5: 0.10, 6: 0.13,
  7: 0.17, 8: 0.24, 9: 0.43, 10: 0.50, 11: 0.62, 12: 0.92,
};

function hexToRgba(hex: string): RGBA {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a: 1,
  };
}

function alphaColorToRgba(c: AlphaColor): RGBA {
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255, a: c.a };
}

// 'gray.0'      → { scale: 'gray',  step: '0',  isAlpha: false, themed: true }
// 'gray.a10'    → { scale: 'gray',  step: '10', isAlpha: true,  themed: true }
// 'black.a8'    → { scale: 'black', step: '8',  isAlpha: true,  themed: false }
// 'white-fixed' → { scale: 'white-fixed', step: '', isAlpha: false, themed: false }
function parseRef(ref: string): { scale: string; step: string; isAlpha: boolean; themed: boolean } {
  if (ref === 'white-fixed') {
    return { scale: 'white-fixed', step: '', isAlpha: false, themed: false };
  }
  const [scale, stepRaw] = ref.split('.');
  const isAlpha = stepRaw.startsWith('a');
  const step = isAlpha ? stepRaw.slice(1) : stepRaw;
  const themed = scale !== 'black';
  return { scale, step, isAlpha, themed };
}

// Substitutes {role} / {roleLabel} placeholders inside a description string.
function applyRoleToDescription(desc: string, role: SemanticRole, namingConfig: NamingConfig): string {
  if (!desc) return desc;
  const label = namingConfig.roleNames[role];
  return desc.replace(/\{role\}/g, label).replace(/\{roleLabel\}/g, label);
}

// Internal scale keys (gray/accent/green/...) → user-facing role names from NamingConfig.
// References stay stable; only the path written into Figma is renamed.
function scaleToUserName(scale: string, namingConfig: NamingConfig): string {
  const pair = ROLE_TO_SCALE.find(([, sn]) => sn === scale);
  if (pair) return namingConfig.roleNames[pair[0]];
  if (scale === 'secondary') return namingConfig.roleNames.secondary;
  return scale;
}

// Maps an internal token-name prefix (used in role slot suffixes / standalone names
// like 'accent-primary') to the role whose label should replace it. For role-slot
// expansion the prefix is the literal scale name, so this is a 1:1 lookup.
const SCALE_TO_ROLE: ReadonlyArray<[string, SemanticRole]> = [
  ['accent', 'brand'],
  ['gray', 'neutral'],
  ['green', 'success'],
  ['amber', 'warning'],
  ['red', 'danger'],
  ['blue', 'info'],
  ['secondary', 'secondary'],
];

// Translates user-typed standalone token names like 'neutral-tertiary' so that the
// 'neutral' prefix becomes whatever roleNames.neutral resolves to. Bare names
// without a known role prefix pass through untouched.
function translateStandaloneName(name: string, namingConfig: NamingConfig): string {
  for (const [, role] of SCALE_TO_ROLE) {
    const internal = role === 'brand' ? 'accent' : role;
    if (name === internal || name.startsWith(`${internal}-`)) {
      const rest = name === internal ? '' : name.slice(internal.length + 1);
      const label = namingConfig.roleNames[role];
      return rest ? `${label}-${rest}` : label;
    }
  }
  return name;
}

function refToPath(ref: string, theme: 'light' | 'dark', namingConfig: NamingConfig): string[] {
  const { scale, step, isAlpha, themed } = parseRef(ref);
  if (scale === 'white-fixed') return ['white-fixed'];
  if (scale === 'black') return [`black-a`, step];
  const userName = scaleToUserName(scale, namingConfig);
  const scaleName = isAlpha ? `${userName}-a` : userName;
  return themed ? [theme, scaleName, step] : [scaleName, step];
}

function refToFallback(
  ref: string,
  theme: 'light' | 'dark',
  input: FigmaTokensInput,
): RGBA {
  const { scale, step, isAlpha } = parseRef(ref);
  if (scale === 'white-fixed') return { r: 1, g: 1, b: 1, a: 1 };
  if (scale === 'black') return { r: 0, g: 0, b: 0, a: BLACK_ALPHA[Number(step) as StepIndex] };

  const data = input[theme];
  const pair = ROLE_TO_SCALE.find(([, sn]) => sn === scale);
  if (!pair) throw new Error(`Unknown primitive scale: ${scale}`);
  const role = pair[0];
  const stepNum = Number(step) as StepIndex;

  if (isAlpha) {
    if (!data.alphaPalette) return hexToRgba(data.palette[role][stepNum]);
    return alphaColorToRgba(data.alphaPalette[role][stepNum]);
  }
  if (scale === 'gray' && stepNum === (0 as unknown as StepIndex)) {
    return hexToRgba(data.backgroundColor);
  }
  return hexToRgba(data.palette[role][stepNum]);
}

// True if the ref ultimately points at the `secondary` primitive scale. Used to
// skip role slots / standalone tokens when secondary brand is disabled.
function refTargetsSecondary(ref: PrimitiveRef): boolean {
  const isSec = (r: string) => parseRef(r).scale === 'secondary';
  return isSec(ref.light) || isSec(ref.dark);
}

// Builds the materialized list of semantic VariableSpecs from a SemanticConfig.
// Exported so the UI can preview names / count without going through the full
// buildVariableStructure pipeline.
export function expandSemanticConfig(
  config: SemanticConfig,
  semanticNaming: SemanticNamingConfig,
  namingConfig: NamingConfig,
  includeSecondary: boolean,
): VariableSpec[] {
  const out: VariableSpec[] = [];

  for (const section of config.sections) {
    // Section name passes through SemanticNamingConfig overrides if present;
    // for sections without an override (user-added sections in the future) we
    // fall back to the section's own `name`.
    const overrides = (semanticNaming.sectionNames as unknown) as Record<string, string | undefined>;
    const sectionLabel = overrides[section.name] ?? section.name;

    // Standalone tokens
    for (const tok of section.standalone) {
      if (!includeSecondary && refTargetsSecondary(tok.ref)) continue;
      const { light, dark } = tok.ref;
      const displayName = translateStandaloneName(tok.name, namingConfig);
      out.push({
        key: `sem:${tok.id}`,
        path: [sectionLabel, displayName],
        description: tok.description ?? '',
        valuesByMode: {
          Light: { aliasOf: { collection: PRIMITIVES, path: refToPath(light, 'light', namingConfig) } },
          Dark: { aliasOf: { collection: PRIMITIVES, path: refToPath(dark, 'dark', namingConfig) } },
        },
      });
    }

    // Role slots — expanded across every role (incl. secondary when enabled)
    const roles: SemanticRole[] = SEMANTIC_ROLES.filter(r => r !== 'secondary' || includeSecondary);
    for (const slot of section.roleSlots) {
      for (const role of roles) {
        const scaleName = roleScaleName(role);
        // The slot ref uses '{role}' as placeholder; substitute the scale name.
        const expandedRef = applyRoleToRef(slot.ref, scaleName);
        if (!includeSecondary && refTargetsSecondary(expandedRef)) continue;
        const { light, dark } = expandedRef;
        const roleLabel = namingConfig.roleNames[role];
        const tokenName = `${roleLabel}-${slot.suffix}`;
        out.push({
          key: `sem:${slot.id}:${role}`,
          path: [sectionLabel, tokenName],
          description: slot.description ? applyRoleToDescription(slot.description, role, namingConfig) : '',
          valuesByMode: {
            Light: { aliasOf: { collection: PRIMITIVES, path: refToPath(light, 'light', namingConfig) } },
            Dark: { aliasOf: { collection: PRIMITIVES, path: refToPath(dark, 'dark', namingConfig) } },
          },
        });
      }
    }
  }

  return out;
}

export function buildVariableStructure(
  input: FigmaTokensInput,
  semanticNaming: SemanticNamingConfig,
  namingConfig: NamingConfig,
  semanticConfig: SemanticConfig,
): VariableStructure {
  const includeSecondary = input.secondary?.mode !== 'off';
  const roles: ReadonlyArray<[SemanticRole, string]> = includeSecondary
    ? [...ROLE_TO_SCALE, ['secondary', 'secondary']]
    : ROLE_TO_SCALE;

  // ---- Primitives ----
  const primitiveVars: VariableSpec[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const data = input[theme];
    for (const [role, scaleName] of roles) {
      const userScaleName = scaleToUserName(scaleName, namingConfig);
      if (scaleName === 'gray') {
        primitiveVars.push({
          key: `prim:${theme}:gray-bg`,
          path: [theme, userScaleName, '0'],
          valuesByMode: { Default: hexToRgba(data.backgroundColor) },
        });
      }
      for (const step of STEP_INDICES) {
        primitiveVars.push({
          key: `prim:${theme}:${role}:solid:${step}`,
          path: [theme, userScaleName, String(step)],
          valuesByMode: { Default: hexToRgba(data.palette[role][step]) },
        });
      }
      if (data.alphaPalette) {
        for (const step of STEP_INDICES) {
          primitiveVars.push({
            key: `prim:${theme}:${role}:alpha:${step}`,
            path: [theme, `${userScaleName}-a`, String(step)],
            valuesByMode: { Default: alphaColorToRgba(data.alphaPalette[role][step]) },
          });
        }
      }
    }
  }

  for (const step of STEP_INDICES) {
    primitiveVars.push({
      key: `prim:black-a:${step}`,
      path: ['black-a', String(step)],
      valuesByMode: { Default: { r: 0, g: 0, b: 0, a: BLACK_ALPHA[step] } },
    });
  }
  primitiveVars.push({
    key: 'prim:white-fixed',
    path: ['white-fixed'],
    valuesByMode: { Default: { r: 1, g: 1, b: 1, a: 1 } },
  });

  // ---- Semantics ----
  const semanticVars = expandSemanticConfig(semanticConfig, semanticNaming, namingConfig, includeSecondary);

  // apply.ts uses the alias path to find the target variable; if it doesn't
  // exist yet it falls back to the literal RGBA via fallbackForAlias.
  void refToFallback;

  return {
    primitives: { name: PRIMITIVES, modes: ['Default'], variables: primitiveVars },
    semantics: { name: SEMANTICS, modes: ['Light', 'Dark'], variables: semanticVars },
  };
}

// Helper available to apply.ts — resolves the literal RGBA fallback for an alias path
// when the target primitive variable cannot be located in the existing Figma collection.
export function fallbackForAlias(
  ref: string,
  theme: 'light' | 'dark',
  input: FigmaTokensInput,
): RGBA {
  return refToFallback(ref, theme, input);
}
