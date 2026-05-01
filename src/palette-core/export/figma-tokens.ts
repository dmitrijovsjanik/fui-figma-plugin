import type { Palette, AlphaPalette, SecondaryConfig, SemanticRole, StepIndex, AlphaColor } from '../types';
import { STEP_INDICES } from '../types';
import { colorToFloatComponents } from '../gamut-mapper';

// === Format target: Figma native DTCG variables import ===
//
// Spec: https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables
//
// Figma accepts DTCG-format JSON files and creates one Figma mode per file
// when dragged into a collection. Cross-collection aliases work via the
// $extensions["com.figma.aliasData"] block — Figma resolves the alias on
// import using `targetVariableSetName` + `targetVariableName`.
//
// Therefore this export produces THREE files:
//   1. primitives.json       → primitives collection (single mode "Default")
//   2. semantics-light.json  → semantics collection, Light mode
//   3. semantics-dark.json   → adds Dark mode to existing semantics collection
//
// Color $value uses the verbose form { colorSpace, components, alpha?, hex? }
// per Figma's DTCG profile (sRGB only — P3 gets converted to sRGB hex).

interface FigmaColorValue {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

interface FigmaAliasData {
  targetVariableSetName: string;
  targetVariableName: string;
}

interface DTCGToken {
  $type: 'color';
  $value: FigmaColorValue;
  $extensions?: { 'com.figma.aliasData': FigmaAliasData };
}

type DTCGTree = { [key: string]: DTCGTree | DTCGToken };

export interface FigmaTokensExportInput {
  light: { palette: Palette; alphaPalette?: AlphaPalette; backgroundColor: string };
  dark: { palette: Palette; alphaPalette?: AlphaPalette; backgroundColor: string };
  secondary?: SecondaryConfig;
}

export interface FigmaTokensExportFiles {
  primitives: string;
  semanticsLight: string;
  semanticsDark: string;
}

const PRIMITIVES_COLLECTION = 'primitives';

// Theme-invariant pure-black alpha scale (Radix `blackA`).
// Components [0,0,0]; alpha taken from this table.
const BLACK_ALPHA: Record<StepIndex, number> = {
  1: 0.012, 2: 0.024, 3: 0.05, 4: 0.075, 5: 0.10, 6: 0.13,
  7: 0.17, 8: 0.24, 9: 0.43, 10: 0.50, 11: 0.62, 12: 0.92,
};

const ROLE_TO_SCALE: ReadonlyArray<[SemanticRole, string]> = [
  ['brand', 'accent'],
  ['neutral', 'gray'],
  ['success', 'green'],
  ['warning', 'amber'],
  ['danger', 'red'],
  ['info', 'blue'],
];

type SemRef = string | { light: string; dark: string };

const SEMANTIC_TOKENS: Record<string, Record<string, SemRef>> = {
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
    'secondary-primary': 'secondary.9',
    'secondary-primary-hover': 'secondary.10',
    'secondary-secondary': 'secondary.a3',
    'secondary-secondary-hover': 'secondary.a4',
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
    'secondary-primary': 'secondary.12',
    'secondary-secondary': 'secondary.11',
    'on-background': 'white-fixed',
  },
  border: {
    // primary (a9, no hover)
    'neutral-primary': 'gray.a9',
    'accent-primary': 'accent.a9',
    'success-primary': 'green.a9',
    'warning-primary': 'amber.a9',
    'danger-primary': 'red.a9',
    'info-primary': 'blue.a9',
    // secondary (a7 default + a8 hover)
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
    // tertiary (a6, no hover)
    'neutral-tertiary': 'gray.a6',
    'accent-tertiary': 'accent.a6',
    'success-tertiary': 'green.a6',
    'warning-tertiary': 'amber.a6',
    'danger-tertiary': 'red.a6',
    'info-tertiary': 'blue.a6',
    // subbrand
    'secondary-primary': 'secondary.a9',
    'secondary-secondary': 'secondary.a7',
    'secondary-secondary-hover': 'secondary.a8',
    'secondary-tertiary': 'secondary.a6',
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

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function hexToFigmaColor(hex: string, alpha = 1): FigmaColorValue {
  const [r, g, b] = colorToFloatComponents(hex);
  // P3 strings come back as float components; we still output sRGB to match
  // Figma's documented import profile. Hex is preserved when input is hex.
  const isHex = hex.startsWith('#');
  return {
    colorSpace: 'srgb',
    components: [round(r), round(g), round(b)],
    alpha: round(alpha),
    ...(isHex ? { hex: hex.toLowerCase() } : {}),
  };
}

function alphaColorToFigma(c: AlphaColor): FigmaColorValue {
  return {
    colorSpace: 'srgb',
    components: [round(c.r / 255), round(c.g / 255), round(c.b / 255)],
    alpha: round(c.a),
  };
}

function blackAlpha(step: StepIndex): FigmaColorValue {
  return {
    colorSpace: 'srgb',
    components: [0, 0, 0],
    alpha: round(BLACK_ALPHA[step]),
  };
}

function setLeaf(tree: DTCGTree, path: string[], leaf: DTCGToken): void {
  let node = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = node[key];
    if (!existing || (existing as DTCGToken).$type !== undefined) {
      node[key] = {} as DTCGTree;
    }
    node = node[key] as DTCGTree;
  }
  node[path[path.length - 1]] = leaf;
}

function buildPrimitives(input: FigmaTokensExportInput): DTCGTree {
  const tree: DTCGTree = {};
  const includeSecondary = input.secondary?.mode !== 'off';

  const roles: ReadonlyArray<[SemanticRole, string]> = includeSecondary
    ? [...ROLE_TO_SCALE, ['secondary', 'secondary']]
    : ROLE_TO_SCALE;

  // Theme at top: light/{scale}/{step}, dark/{scale}/{step}
  for (const theme of ['light', 'dark'] as const) {
    const data = input[theme];
    for (const [role, scaleName] of roles) {
      if (scaleName === 'gray') {
        setLeaf(tree, [theme, scaleName, '0'], {
          $type: 'color',
          $value: hexToFigmaColor(data.backgroundColor),
        });
      }
      for (const step of STEP_INDICES) {
        setLeaf(tree, [theme, scaleName, String(step)], {
          $type: 'color',
          $value: hexToFigmaColor(data.palette[role][step]),
        });
      }
      if (data.alphaPalette) {
        for (const step of STEP_INDICES) {
          setLeaf(tree, [theme, `${scaleName}-a`, String(step)], {
            $type: 'color',
            $value: alphaColorToFigma(data.alphaPalette[role][step]),
          });
        }
      }
    }
  }

  // Theme-invariant
  for (const step of STEP_INDICES) {
    setLeaf(tree, ['black-a', String(step)], {
      $type: 'color',
      $value: blackAlpha(step),
    });
  }
  setLeaf(tree, ['white-fixed'], {
    $type: 'color',
    $value: hexToFigmaColor('#ffffff'),
  });

  return tree;
}

// 'gray.0'      → { name: 'light/gray/0',     fallback: <hex from input.light> }
// 'gray.a10'    → { name: 'dark/gray-a/10',   fallback: <alpha rgba> }
// 'black.a8'    → { name: 'black-a/8',        fallback: <0,0,0,0.24> }
// 'white-fixed' → { name: 'white-fixed',      fallback: <#ffffff> }
function resolveRef(
  ref: string,
  theme: 'light' | 'dark',
  input: FigmaTokensExportInput,
): { name: string; fallback: FigmaColorValue } {
  if (ref === 'white-fixed') {
    return { name: 'white-fixed', fallback: hexToFigmaColor('#ffffff') };
  }
  const [scale, stepRaw] = ref.split('.');
  const isAlpha = stepRaw.startsWith('a');
  const step = (isAlpha ? Number(stepRaw.slice(1)) : Number(stepRaw)) as StepIndex;

  if (scale === 'black') {
    return { name: `black-a/${step}`, fallback: blackAlpha(step) };
  }

  // Map scale name back to palette role
  const pair = ROLE_TO_SCALE.find(([, sn]) => sn === scale);
  if (!pair) throw new Error(`Unknown primitive scale: ${scale}`);
  const role = pair[0];

  const themeData = input[theme];
  const scaleName = isAlpha ? `${scale}-a` : scale;
  const name = `${theme}/${scaleName}/${step}`;

  let fallback: FigmaColorValue;
  if (isAlpha) {
    if (!themeData.alphaPalette) {
      // No background → no alpha palette computed. Fall back to solid.
      fallback = hexToFigmaColor(themeData.palette[role][step]);
    } else {
      fallback = alphaColorToFigma(themeData.alphaPalette[role][step]);
    }
  } else if (scale === 'gray' && step === (0 as unknown as StepIndex)) {
    fallback = hexToFigmaColor(themeData.backgroundColor);
  } else {
    fallback = hexToFigmaColor(themeData.palette[role][step]);
  }

  return { name, fallback };
}

function buildSemanticsForMode(
  mode: 'light' | 'dark',
  input: FigmaTokensExportInput,
): DTCGTree {
  const tree: DTCGTree = {};
  for (const [section, tokens] of Object.entries(SEMANTIC_TOKENS)) {
    for (const [name, ref] of Object.entries(tokens)) {
      const r = typeof ref === 'string' ? ref : ref[mode];
      const { name: targetName, fallback } = resolveRef(r, mode, input);
      setLeaf(tree, [section, name], {
        $type: 'color',
        $value: fallback,
        $extensions: {
          'com.figma.aliasData': {
            targetVariableSetName: PRIMITIVES_COLLECTION,
            targetVariableName: targetName,
          },
        },
      });
    }
  }
  return tree;
}

export function exportFigmaTokens(input: FigmaTokensExportInput): FigmaTokensExportFiles {
  return {
    primitives: JSON.stringify(buildPrimitives(input), null, 2),
    semanticsLight: JSON.stringify(buildSemanticsForMode('light', input), null, 2),
    semanticsDark: JSON.stringify(buildSemanticsForMode('dark', input), null, 2),
  };
}
