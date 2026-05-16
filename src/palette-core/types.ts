// Color space types
export interface OklchColor {
  l: number;  // 0-1
  c: number;  // 0-0.4+
  h: number;  // 0-360
}

export type HexColor = string; // #rrggbb

// Scale types (Radix 12-step model)
export type StepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export const STEP_INDICES: StepIndex[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export type ColorScale = Record<StepIndex, HexColor>;
export type OklchScale = Record<StepIndex, OklchColor>;

// Semantic roles
export type SemanticRole = 'brand' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export const SEMANTIC_ROLES: SemanticRole[] = ['brand', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'];

// Brand step 9 strategy
export type BrandMode = 'auto' | 'fixed';

// Dark theme brand adaptation when brandMode is 'fixed'
// 'adaptive' = keep hue/chroma, adapt lightness algorithmically (recommended)
// 'fixed' = use exact same color in dark theme (may have contrast issues)
export type DarkBrandAdaptation = 'adaptive' | 'fixed';

// Chroma equalization across semantic roles
export type ChromaEqualization = 'independent' | 'equal';

// Theme
export type ThemeMode = 'light' | 'dark';

// Neutral style — controls the *hue/chroma* curve of the neutral scale.
//  'tinted'    — neutral hue follows brand, slight chroma (default)
//  'pure-gray' — chromaless neutral
// Note: contrast-neutral mode is an independent boolean (config.contrastNeutral)
// that only overrides steps 9 + 10 and is compatible with either style above.
export type NeutralStyle = 'tinted' | 'pure-gray';

// Secondary brand color harmony
export type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'split-complementary' | 'tetradic';
export type HarmonyVariation = 'positive' | 'negative';
export type SecondaryMode = 'off' | 'auto' | 'custom';

export interface SecondaryConfig {
  mode: SecondaryMode;
  harmonyType: HarmonyType;
  harmonyVariation: HarmonyVariation;
  customColor?: HexColor;
}

// Semantic harmony — pull status hues toward harmonic anchors
export type SemanticHarmonyMode = 'off' | 'auto';

export interface SemanticHarmonyConfig {
  mode: SemanticHarmonyMode;
  harmonyType: HarmonyType;
  strength: number; // 0-1
}

// Full palette
export type Palette = Record<SemanticRole, ColorScale>;
export type OklchPalette = Record<SemanticRole, OklchScale>;

// Alpha color (semi-transparent equivalent over a background)
export interface AlphaColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-1
  css: string; // rgba(r, g, b, a)
}
export type AlphaColorScale = Record<StepIndex, AlphaColor>;
export type AlphaPalette = Record<SemanticRole, AlphaColorScale>;

// Naming config for token export
export type TemplateVariable = 'theme' | 'role' | 'mode' | 'step';

export type TemplatePart =
  | { type: 'variable'; value: TemplateVariable }
  | { type: 'separator'; value: string };

export interface NamingConfig {
  segments: TemplatePart[];
  roleNames: Record<SemanticRole, string>;
  themeNames: Record<'light' | 'dark', string>;
  modeNames: Record<'solid' | 'alpha', string>;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = ['theme', 'role', 'mode', 'step'];

export const DEFAULT_NAMING_CONFIG: NamingConfig = {
  segments: [
    { type: 'variable', value: 'theme' },
    { type: 'separator', value: '/' },
    { type: 'variable', value: 'role' },
    { type: 'separator', value: '/' },
    { type: 'variable', value: 'mode' },
    { type: 'separator', value: '/' },
    { type: 'variable', value: 'step' },
  ],
  roleNames: { brand: 'brand', secondary: 'subbrand', success: 'success', warning: 'warning', danger: 'danger', info: 'info', neutral: 'neutral' },
  themeNames: { light: 'light', dark: 'dark' },
  modeNames: { solid: 'solid', alpha: 'alpha' },
};

export function resolveTokenName(
  config: NamingConfig,
  theme: 'light' | 'dark',
  role: SemanticRole,
  mode: 'solid' | 'alpha',
  step: StepIndex,
): string {
  return config.segments.map(part => {
    if (part.type === 'separator') return part.value;
    switch (part.value) {
      case 'theme': return config.themeNames[theme];
      case 'role': return config.roleNames[role];
      case 'mode': return config.modeNames[mode];
      case 'step': return String(step);
    }
  }).join('');
}

// Generation config
export interface GenerationConfig {
  brandColor: HexColor;
  brandMode: BrandMode;         // auto = algorithmic step 9, fixed = exact input color
  chromaEqualization: ChromaEqualization; // independent = max per-role, equal = min across roles
  theme: ThemeMode;
  neutralStyle: NeutralStyle;
  tintStrength?: number; // 0-1, controls tinted neutral chroma (default 0.5)
  gamut: 'sRGB' | 'P3';
  backgroundColor?: HexColor; // for alpha color computation
  darkBrandAdaptation: DarkBrandAdaptation; // how fixed brand adapts in dark theme
  secondary?: SecondaryConfig;
  semanticHarmony?: SemanticHarmonyConfig;
  stepPositions?: Record<number, number>; // Custom step 1-8 position fractions (overrides defaults)
  equalizeLightness?: boolean; // Force all roles to use same lightness per step (brand's L)
  /** Force neutral steps 9 (pure black/white) and 10 (L 0.3 / 0.7) to extremes. Independent of neutralStyle — steps 1-8 / 11-12 still follow tinted/pure-gray. */
  contrastNeutral?: boolean;
}

// Semantic hues result
export interface SemanticHues {
  brand: number;
  secondary: number;
  success: number;
  warning: number;
  danger: number;
  info: number;
  neutral: number; // hue for tinted neutral
}

// Contrast result
export interface ContrastResult {
  role: SemanticRole;
  fgStep: StepIndex;
  bgStep: StepIndex;
  apca: number;
  wcag: number;
  passAPCA: boolean;
  passWCAG_AA: boolean;
  label: string;
}

// Accessibility report
export interface AccessibilityReport {
  results: ContrastResult[];
  overallPass: boolean;
  textPairsPass: boolean;
  borderPairsPass: boolean;
}

// Generation result
export interface GenerationResult {
  palette: Palette;
  oklchPalette: OklchPalette;
  alphaPalette?: AlphaPalette;
  semanticHues: SemanticHues;
  accessibility: AccessibilityReport;
  /** Algorithmic default step 9 lightness for the brand scale (before user overrides) */
  defaultStep9L: number;
  config: GenerationConfig;
}
