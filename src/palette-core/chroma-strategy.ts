import type { GenerationConfig, OklchColor, SemanticHues, SemanticRole } from './types';
import { maxChromaForLH } from './gamut-mapper';
import { computeStep9Lightness } from './scale-generator';

// Angular distance on the hue circle (0-180)
function angularDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Estimate the actual step 9 lightness for a semantic role,
// accounting for: (1) per-hue optimal L (bright hues like teal/amber get boosted)
// and (2) adaptive brand lightness shift based on hue proximity.
function estimateSemanticStep9L(
  hue: number,
  brandHue: number,
  brandStep9L: number,
  gamut: 'sRGB' | 'P3'
): number {
  let baseL = computeStep9Lightness(hue, gamut);

  // Adaptive blend: closer hues blend more toward brand lightness (stronger coherence)
  const hueDistance = angularDistance(hue, brandHue);
  // blendFactor: 0.5 for same hue, 0.2 for opposite (180°), smooth interpolation
  const blendFactor = 0.2 + 0.3 * (1 - hueDistance / 180);

  baseL = baseL + (brandStep9L - baseL) * blendFactor;
  return Math.max(0.45, Math.min(0.90, baseL));
}

// Resolve peak chroma for each semantic role based on config.
// Applies chroma coherence: semantic chromas are capped relative to brand
// so that no role visually outshouts the brand color.
export function resolveChromaStrategy(
  config: GenerationConfig,
  brandOklch: OklchColor,
  hues: SemanticHues,
  gamut: 'sRGB' | 'P3',
  secondaryOklch?: OklchColor,
): Record<SemanticRole, number> {
  const { brandMode, chromaEqualization, neutralStyle } = config;
  const isSecondaryCustom = config.secondary?.mode === 'custom' && secondaryOklch;

  const tintStrength = config.tintStrength ?? 0.5;
  const neutralChroma = neutralStyle === 'tinted' ? 0.014 * tintStrength : 0;

  // Brand step 9 L depends on brandMode:
  // fixed = exact user input L, auto = algorithmic optimal for this hue
  const brandStep9L = brandMode === 'fixed'
    ? brandOklch.l
    : computeStep9Lightness(hues.brand, gamut);

  // Brand chroma — the reference for coherence.
  // fixed: exact user chroma. auto: user's chroma as ratio of gamut maximum —
  // picking a desaturated color scales down the whole palette proportionally,
  // while lightness stays at the algorithmic optimum (unlike fixed).
  const gamutMaxBrand = maxChromaForLH(brandStep9L, hues.brand, gamut);
  let brandChroma: number;
  if (brandMode === 'fixed') {
    brandChroma = brandOklch.c;
  } else {
    const userMaxC = maxChromaForLH(brandOklch.l, hues.brand, gamut);
    const chromaRatio = userMaxC > 0.001 ? brandOklch.c / userMaxC : 1;
    brandChroma = gamutMaxBrand * chromaRatio;
  }

  // Chroma coherence ceiling: semantic roles can be at most 1.15x brand chroma.
  // This keeps the palette feeling unified — no role wildly outsaturates the brand.
  // Minimum floor ensures semantic colors stay distinguishable even with low-chroma brands
  // (e.g. grey or pastel brand in fixed mode). 0.08 is roughly the threshold
  // where hue differences become visually apparent in OKLCH.
  const MIN_SEMANTIC_CHROMA = 0.15;
  const chromaCeiling = Math.max(MIN_SEMANTIC_CHROMA, brandChroma * 1.15);

  // Per-role step 9 L (hue-aware + brand-blended with adaptive factor)
  // When equalizeLightness is on, all non-neutral roles use brandStep9L
  const eqLight = config.equalizeLightness;
  const roleLightness: Record<Exclude<SemanticRole, 'neutral'>, number> = {
    brand: brandStep9L,
    secondary: isSecondaryCustom
      ? secondaryOklch.l
      : eqLight ? brandStep9L : estimateSemanticStep9L(hues.secondary, hues.brand, brandStep9L, gamut),
    success: eqLight ? brandStep9L : estimateSemanticStep9L(hues.success, hues.brand, brandStep9L, gamut),
    warning: eqLight ? brandStep9L : estimateSemanticStep9L(hues.warning, hues.brand, brandStep9L, gamut),
    danger: eqLight ? brandStep9L : estimateSemanticStep9L(hues.danger, hues.brand, brandStep9L, gamut),
    info: eqLight ? brandStep9L : estimateSemanticStep9L(hues.info, hues.brand, brandStep9L, gamut),
  };

  // Compute max chroma for each role at its actual step 9 lightness
  const gamutMax: Record<Exclude<SemanticRole, 'neutral'>, number> = {
    brand: brandChroma,
    secondary: isSecondaryCustom
      ? secondaryOklch.c
      : maxChromaForLH(roleLightness.secondary, hues.secondary, gamut),
    success: maxChromaForLH(roleLightness.success, hues.success, gamut),
    warning: maxChromaForLH(roleLightness.warning, hues.warning, gamut),
    danger: maxChromaForLH(roleLightness.danger, hues.danger, gamut),
    info: maxChromaForLH(roleLightness.info, hues.info, gamut),
  };

  // Apply chroma coherence — cap semantic roles to chromaCeiling
  const semanticKeys: (keyof typeof gamutMax)[] = ['success', 'warning', 'danger', 'info'];
  const coherentChromas: Record<Exclude<SemanticRole, 'neutral'>, number> = { ...gamutMax };
  for (const key of semanticKeys) {
    coherentChromas[key] = Math.min(gamutMax[key], chromaCeiling);
  }
  // Secondary gets a slightly looser ceiling (1.25x) since it's a brand companion
  if (!isSecondaryCustom) {
    coherentChromas.secondary = Math.min(gamutMax.secondary, brandChroma * 1.25);
  }

  // Apply equalization if requested
  if (chromaEqualization === 'equal') {
    // Brand participates in equalization unless fixed by user
    const brandFixed = brandMode === 'fixed';
    const eqKeys = [...semanticKeys];
    if (!brandFixed) eqKeys.push('brand');
    if (!isSecondaryCustom) eqKeys.push('secondary');

    const allValues = eqKeys.map(k => coherentChromas[k]);
    const minChroma = Math.min(...allValues);
    return {
      brand: brandFixed ? coherentChromas.brand : minChroma,
      secondary: isSecondaryCustom ? coherentChromas.secondary : minChroma,
      success: minChroma,
      warning: minChroma,
      danger: minChroma,
      info: minChroma,
      neutral: neutralChroma,
    };
  }

  // Independent — each role gets its coherent chroma
  return {
    brand: coherentChromas.brand,
    secondary: coherentChromas.secondary,
    success: coherentChromas.success,
    warning: coherentChromas.warning,
    danger: coherentChromas.danger,
    info: coherentChromas.info,
    neutral: neutralChroma,
  };
}
