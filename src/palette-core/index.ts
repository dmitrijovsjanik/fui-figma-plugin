import type {
  GenerationConfig,
  GenerationResult,
  Palette,
  OklchPalette,
  AlphaPalette,
  OklchColor,
} from './types';
import { SEMANTIC_ROLES } from './types';
import { hexToOklch } from './gamut-mapper';
import { resolveSemanticHues } from './semantic-resolver';
import { resolveChromaStrategy } from './chroma-strategy';
import { resolveSecondaryHue } from './color-harmony';
import { generateLightThemeScale, generateDarkThemeScale } from './scale-generator';
import { auditPalette } from './contrast-checker';
import { computeAlphaScale } from './alpha-colors';

export function generatePalette(config: GenerationConfig): GenerationResult {
  // 1. Parse brand color
  const brandOklch = hexToOklch(config.brandColor);

  // 1b. Resolve secondary brand hue
  let secondaryOklch: OklchColor | undefined;
  let secondaryHue: number;
  const sec = config.secondary;

  if (sec && sec.mode === 'custom' && sec.customColor) {
    secondaryOklch = hexToOklch(sec.customColor);
    secondaryHue = secondaryOklch.h;
  } else if (sec && sec.mode === 'auto') {
    secondaryHue = resolveSecondaryHue(brandOklch.h, sec);
  } else {
    secondaryHue = brandOklch.h;
  }

  // 2. Resolve semantic hues (with secondary for conflict avoidance)
  const hues = resolveSemanticHues(brandOklch.h, config.neutralStyle, secondaryHue, config.semanticHarmony);

  // 3. Resolve chroma strategy
  const chromas = resolveChromaStrategy(config, brandOklch, hues, config.gamut, secondaryOklch);

  // 4. Select scale generator based on theme
  const isDark = config.theme === 'dark';
  const generateScale = isDark
    ? generateDarkThemeScale
    : generateLightThemeScale;

  // Compute background lightness for offset-based scale (both themes)
  const bgL = config.backgroundColor
    ? hexToOklch(config.backgroundColor).l
    : undefined;

  // 5. Generate scales for each role
  const palette = {} as Palette;
  const oklchPalette = {} as OklchPalette;

  // Dark mode + fixed brand + adaptive: keep hue, adapt lightness, cap chroma
  const useFixedBrand = config.brandMode === 'fixed'
    && !(isDark && config.darkBrandAdaptation === 'adaptive');

  // First, compute the brand scale to know its step 9 L
  const brandScale = generateScale({
    hue: hues.brand,
    peakChroma: chromas.brand,
    gamut: config.gamut,
    fixedStep9: useFixedBrand ? brandOklch : undefined,
    isNeutral: false,
    // When adapting in dark mode, pass user's chroma as ceiling
    brandChromaCeiling: (isDark && config.darkBrandAdaptation === 'adaptive' && config.brandMode === 'fixed')
      ? brandOklch.c
      : undefined,
    backgroundLightness: bgL,
    stepPositions: config.stepPositions,
  });
  const brandStep9L = brandScale.oklchScale[9].l;
  const defaultStep9L = brandScale.defaultStep9L;

  // Equalize lightness: force all non-neutral roles to use brand's step 9 L
  const eqL = config.equalizeLightness ? brandStep9L : undefined;

  // Generate secondary scale
  const isSecondaryCustomFixed = sec?.mode === 'custom' && secondaryOklch;
  const secondaryScale = generateScale({
    hue: hues.secondary,
    peakChroma: chromas.secondary,
    gamut: config.gamut,
    fixedStep9: isSecondaryCustomFixed ? secondaryOklch : undefined,
    isNeutral: false,
    brandLightness: brandStep9L,
    backgroundLightness: bgL,
    stepPositions: config.stepPositions,
    forcedStep9L: eqL,
  });

  for (const role of SEMANTIC_ROLES) {
    if (role === 'brand') {
      palette[role] = brandScale.hexScale;
      oklchPalette[role] = brandScale.oklchScale;
      continue;
    }
    if (role === 'secondary') {
      palette[role] = secondaryScale.hexScale;
      oklchPalette[role] = secondaryScale.oklchScale;
      continue;
    }

    const isNeutral = role === 'neutral';
    const { oklchScale, hexScale } = generateScale({
      hue: hues[role],
      peakChroma: chromas[role],
      gamut: config.gamut,
      isNeutral,
      contrastNeutral: isNeutral && config.contrastNeutral === true,
      brandLightness: isNeutral ? undefined : brandStep9L,
      backgroundLightness: bgL,
      stepPositions: config.stepPositions,
      forcedStep9L: isNeutral ? undefined : eqL,
      });

    palette[role] = hexScale;
    oklchPalette[role] = oklchScale;
  }

  // 6. Compute alpha palette if background color specified
  let alphaPalette: AlphaPalette | undefined;
  if (config.backgroundColor) {
    alphaPalette = {} as AlphaPalette;
    for (const role of SEMANTIC_ROLES) {
      alphaPalette[role] = computeAlphaScale(palette[role], config.backgroundColor, config.gamut);
    }
  }

  // 7. Audit accessibility
  const accessibility = auditPalette(palette);

  return {
    palette,
    oklchPalette,
    ...(alphaPalette ? { alphaPalette } : {}),
    semanticHues: hues,
    accessibility,
    defaultStep9L,
    config,
  };
}

// Re-export everything
export * from './types';
export * from './gamut-mapper';
export * from './semantic-resolver';
export * from './scale-generator';
export * from './chroma-strategy';
export * from './contrast-checker';
export * from './alpha-colors';
export * from './color-harmony';
export * from './semantic-config';
export * from './export';
