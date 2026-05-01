// Neutral, in-memory representation of the variable structure (collections + variables).
// Single source of truth for both:
//   - DTCG JSON serialization (legacy / future)
//   - Direct figma.variables.* materialization (apply.ts)
//
// Build it once via buildVariableStructure(input, semanticNaming), then consume.

import type {
  Palette,
  AlphaPalette,
  SecondaryConfig,
  SemanticRole,
  StepIndex,
  AlphaColor,
  NamingConfig,
} from '../palette-core';
import { STEP_INDICES } from '../palette-core';
import type { SemanticNamingConfig, SemanticSection } from '../ui/persistence-types';

export type RGBA = { r: number; g: number; b: number; a: number };

export interface VariableSpec {
  // Stable identity that survives renames. Format:
  //   primitives: 'prim:<theme>:<role>:<solid|alpha>:<step>'
  //   primitives (special): 'prim:<theme>:gray-bg' / 'prim:black-a:<step>' / 'prim:white-fixed'
  //   semantics:  'sem:<section>:<token-name>'
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

type SemRef = string | { light: string; dark: string };

const SEMANTIC_TOKENS: Record<SemanticSection, Record<string, SemRef>> = {
  bg: {
    'canvas': 'gray.0',
    'primary': 'gray.0',
    'secondary': 'gray.1',
    'surface-0': 'gray.1',
    'surface-1': { light: 'gray.0', dark: 'gray.1' },
    'surface-2': { light: 'gray.0', dark: 'gray.2' },
    'surface-3': { light: 'gray.0', dark: 'gray.3' },
    'surface-4': { light: 'gray.0', dark: 'gray.4' },
    'neutral-primary': 'gray.9',
    'neutral-primary-hover': 'gray.10',
    'neutral-secondary': 'gray.a3',
    'neutral-secondary-hover': 'gray.a4',
    'accent-primary': 'accent.9',
    'accent-primary-hover': 'accent.10',
    'accent-secondary': 'accent.a3',
    'accent-secondary-hover': 'accent.a4',
    'success-primary': 'green.9',
    'success-primary-hover': 'green.10',
    'success-secondary': 'green.a3',
    'success-secondary-hover': 'green.a4',
    'warning-primary': 'amber.9',
    'warning-primary-hover': 'amber.10',
    'warning-secondary': 'amber.a3',
    'warning-secondary-hover': 'amber.a4',
    'danger-primary': 'red.9',
    'danger-primary-hover': 'red.10',
    'danger-secondary': 'red.a3',
    'danger-secondary-hover': 'red.a4',
    'info-primary': 'blue.9',
    'info-primary-hover': 'blue.10',
    'info-secondary': 'blue.a3',
    'info-secondary-hover': 'blue.a4',
  },
  fg: {
    'neutral-primary': 'gray.12',
    'neutral-secondary': 'gray.11',
    'neutral-tertiary': 'gray.a10',
    'accent-primary': 'accent.12',
    'accent-secondary': 'accent.11',
    'success-primary': 'green.12',
    'success-secondary': 'green.11',
    'warning-primary': 'amber.12',
    'warning-secondary': 'amber.11',
    'danger-primary': 'red.12',
    'danger-secondary': 'red.11',
    'info-primary': 'blue.12',
    'info-secondary': 'blue.11',
    'on-background': 'white-fixed',
  },
  border: {
    // primary (step a9, no hover) — strongest outline / focus emphasis
    'neutral-primary': 'gray.a9',
    'accent-primary': 'accent.a9',
    'success-primary': 'green.a9',
    'warning-primary': 'amber.a9',
    'danger-primary': 'red.a9',
    'info-primary': 'blue.a9',
    // secondary (a7 default + a8 hover) — interactive borders
    'neutral-secondary': 'gray.a7',
    'neutral-secondary-hover': 'gray.a8',
    'accent-secondary': 'accent.a7',
    'accent-secondary-hover': 'accent.a8',
    'success-secondary': 'green.a7',
    'success-secondary-hover': 'green.a8',
    'warning-secondary': 'amber.a7',
    'warning-secondary-hover': 'amber.a8',
    'danger-secondary': 'red.a7',
    'danger-secondary-hover': 'red.a8',
    'info-secondary': 'blue.a7',
    'info-secondary-hover': 'blue.a8',
    // tertiary (a6, no hover) — subtle decorative lines, separators
    'neutral-tertiary': 'gray.a6',
    'accent-tertiary': 'accent.a6',
    'success-tertiary': 'green.a6',
    'warning-tertiary': 'amber.a6',
    'danger-tertiary': 'red.a6',
    'info-tertiary': 'blue.a6',
  },
  ring: {
    'focus': 'accent.a8',
    'focus-error': 'red.a8',
  },
  overlay: {
    'scrim': { light: 'black.a8', dark: 'black.a9' },
    'hover': 'gray.a3',
    'active': 'gray.a4',
  },
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

// Generates the native Figma description for a semantic token. Token names
// follow the regular <role>-<level>[-hover] schema; special cases get explicit
// descriptions. Re-set on every sync so names stay current with NamingConfig.
function describeSemanticToken(
  section: SemanticSection,
  name: string,
  namingConfig: NamingConfig,
): string {
  const roleLabel = (role: SemanticRole) => namingConfig.roleNames[role];

  // Recognised colored-role prefix? Match `<role>-rest` against known roles.
  const colored = (() => {
    for (const role of ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const) {
      const internalRole: SemanticRole = role === 'brand' ? 'brand' : role;
      // Map internal role names to their token-key prefix (brand → 'accent').
      const prefix = role === 'brand' ? 'accent' : role;
      if (name === prefix || name.startsWith(`${prefix}-`)) {
        return {
          rolePrefix: prefix,
          userPrefix: roleLabel(internalRole),
          role: internalRole,
          label: roleLabel(internalRole),
          rest: name === prefix ? '' : name.slice(prefix.length + 1),
        };
      }
    }
    return null;
  })();

  if (section === 'bg') {
    if (name === 'canvas') return 'Page canvas — topmost surface, behind everything else.';
    if (name === 'primary') return 'Primary surface for cards, panels, and other content containers.';
    if (name === 'secondary') return 'Recessed surface — sits below bg/primary for visual layering.';
    if (/^surface-\d$/.test(name)) {
      const lvl = name.slice('surface-'.length);
      return `Elevation level ${lvl} — for stacked panels, menus, and popovers.`;
    }
    if (colored) {
      const { rest, label, userPrefix } = colored;
      const map: Record<string, string> = {
        'primary': `Solid ${label} surface — buttons, badges, active states.`,
        'primary-hover': `Hover state of bg/${userPrefix}-primary.`,
        'secondary': `Subtle ${label} surface — selected rows, ghost buttons, soft fills.`,
        'secondary-hover': `Hover state of bg/${userPrefix}-secondary.`,
      };
      return map[rest] ?? '';
    }
  }

  if (section === 'fg') {
    if (name === 'on-background') {
      return 'White text on saturated colored backgrounds (bg/*-primary).';
    }
    if (colored) {
      const { rest, label } = colored;
      const map: Record<string, string> = {
        'primary': colored.role === 'neutral' ? 'Primary text color — body, headings.' : `Primary ${label} text — emphasis.`,
        'secondary': colored.role === 'neutral' ? 'Secondary text — labels, supporting copy.' : `Secondary (muted) ${label} text.`,
        'tertiary': 'Tertiary text — placeholders, disabled, deeply muted copy.',
      };
      return map[rest] ?? '';
    }
  }

  if (section === 'border') {
    if (colored) {
      const { rest, label, userPrefix } = colored;
      const map: Record<string, string> = {
        'primary': `Strongest ${label} border — focus emphasis, key outlines.`,
        'secondary': `Default interactive ${label} border — inputs, buttons.`,
        'secondary-hover': `Hover state of border/${userPrefix}-secondary.`,
        'tertiary': `Subtle ${label} border — dividers, decorative separators.`,
      };
      return map[rest] ?? '';
    }
  }

  if (section === 'ring') {
    if (name === 'focus') return 'Focus ring on interactive elements.';
    if (name === 'focus-error') return 'Focus ring when the element is in error state.';
  }

  if (section === 'overlay') {
    if (name === 'scrim') return 'Backdrop behind modals and dialogs.';
    if (name === 'hover') return 'Translucent hover overlay on interactive elements.';
    if (name === 'active') return 'Translucent pressed/active overlay on interactive elements.';
  }

  return '';
}

// Internal scale keys (gray/accent/green/...) → user-facing role names from NamingConfig.
// SEMANTIC_TOKENS references stay stable; only the path written into Figma is renamed.
function scaleToUserName(scale: string, namingConfig: NamingConfig): string {
  const pair = ROLE_TO_SCALE.find(([, sn]) => sn === scale);
  if (pair) return namingConfig.roleNames[pair[0]];
  if (scale === 'secondary') return namingConfig.roleNames.secondary;
  return scale;
}

// Token names in SEMANTIC_TOKENS keep stable internal prefixes (e.g. 'accent-primary').
// At write time we swap the prefix for the user-facing role name from NamingConfig
// so 'accent-primary' becomes 'brand-primary' when roleNames.brand = 'brand'.
const TOKEN_PREFIX_TO_ROLE: ReadonlyArray<[string, SemanticRole]> = [
  ['accent', 'brand'],
  ['neutral', 'neutral'],
  ['success', 'success'],
  ['warning', 'warning'],
  ['danger', 'danger'],
  ['info', 'info'],
  ['secondary', 'secondary'],
];

function translateTokenName(name: string, namingConfig: NamingConfig): string {
  // Only translate compound names (<role>-rest). Standalone names like
  // 'secondary' (bg/secondary = the page-level secondary surface) are
  // special semantic concepts unrelated to the secondary brand role.
  for (const [internalPrefix, role] of TOKEN_PREFIX_TO_ROLE) {
    if (name.startsWith(`${internalPrefix}-`)) {
      return `${namingConfig.roleNames[role]}-${name.slice(internalPrefix.length + 1)}`;
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

export function buildVariableStructure(
  input: FigmaTokensInput,
  semanticNaming: SemanticNamingConfig,
  namingConfig: NamingConfig,
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
  const semanticVars: VariableSpec[] = [];
  for (const [section, tokens] of Object.entries(SEMANTIC_TOKENS) as Array<[
    SemanticSection,
    Record<string, SemRef>,
  ]>) {
    const sectionLabel = semanticNaming.sectionNames[section];
    for (const [name, ref] of Object.entries(tokens)) {
      const lightRef = typeof ref === 'string' ? ref : ref.light;
      const darkRef = typeof ref === 'string' ? ref : ref.dark;
      semanticVars.push({
        key: `sem:${section}:${name}`,
        path: [sectionLabel, translateTokenName(name, namingConfig)],
        description: describeSemanticToken(section, name, namingConfig),
        valuesByMode: {
          Light: { aliasOf: { collection: PRIMITIVES, path: refToPath(lightRef, 'light', namingConfig) } },
          Dark: { aliasOf: { collection: PRIMITIVES, path: refToPath(darkRef, 'dark', namingConfig) } },
        },
      });
      // Note: we keep the alias-only form. apply.ts uses the alias path to find
      // the target variable; if it exists, creates a Figma alias. If not, falls
      // back to the literal RGBA computed from refToFallback (computed lazily there).
      void refToFallback;
    }
  }

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
