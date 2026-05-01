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
    'neutral': 'gray.9',
    'neutral-hover': 'gray.10',
    'neutral-subtle': 'gray.a3',
    'neutral-subtle-hover': 'gray.a4',
    'accent': 'accent.9',
    'accent-hover': 'accent.10',
    'accent-subtle': 'accent.a3',
    'accent-subtle-hover': 'accent.a4',
    'success': 'green.9',
    'success-hover': 'green.10',
    'success-subtle': 'green.a3',
    'success-subtle-hover': 'green.a4',
    'warning': 'amber.9',
    'warning-hover': 'amber.10',
    'warning-subtle': 'amber.a3',
    'warning-subtle-hover': 'amber.a4',
    'danger': 'red.9',
    'danger-hover': 'red.10',
    'danger-subtle': 'red.a3',
    'danger-subtle-hover': 'red.a4',
    'info': 'blue.9',
    'info-hover': 'blue.10',
    'info-subtle': 'blue.a3',
    'info-subtle-hover': 'blue.a4',
  },
  fg: {
    'neutral-primary': 'gray.12',
    'neutral-secondary': 'gray.11',
    'neutral-tertiary': 'gray.a10',
    'link': 'blue.11',
    'link-hover': 'blue.12',
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
    'on-accent': 'white-fixed',
    'on-success': 'white-fixed',
    'on-warning': 'amber.12',
    'on-danger': 'white-fixed',
    'on-info': 'white-fixed',
  },
  border: {
    'default': 'gray.a6',
    'strong': 'gray.a7',
    'strong-hover': 'gray.a8',
    'accent': 'accent.a8',
    'success': 'green.a7',
    'warning': 'amber.a7',
    'danger': 'red.a7',
    'info': 'blue.a7',
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

// Internal scale keys (gray/accent/green/...) → user-facing role names from NamingConfig.
// SEMANTIC_TOKENS references stay stable; only the path written into Figma is renamed.
function scaleToUserName(scale: string, namingConfig: NamingConfig): string {
  const pair = ROLE_TO_SCALE.find(([, sn]) => sn === scale);
  if (pair) return namingConfig.roleNames[pair[0]];
  if (scale === 'secondary') return namingConfig.roleNames.secondary;
  return scale;
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
        path: [sectionLabel, name],
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
