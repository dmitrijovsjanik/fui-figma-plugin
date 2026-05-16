import type { OklchColor, OklchScale, StepIndex, ColorScale } from './types';
import { STEP_INDICES } from './types';
import { gamutMapOklch, maxChromaForLH } from './gamut-mapper';

// --- Unified Lightness Generation ---
//
// All steps 1-12 (except fixed 9-10) use a single principle:
//
// 1. Each step is a fixed fraction of the [bg, step9] range.
// 2. As bg moves toward step 9, all steps compress proportionally.
// 3. Dark theme: decelerating curve (big jump 1→2, smaller gaps near step 9).
//    Human vision needs larger L differences to distinguish dark surfaces.
// 4. Light theme: accelerating curve (tiny gaps near white bg, big jumps near step 9).
//    Human vision is very sensitive to subtle differences in light tones.
// 5. Wall compression as safety net for steps 10-12.

// Step positions: fraction of the [bg, step9] range in L³ space (≈ luminance).
// Interpolating in L³ ensures equal perceived contrast at any background lightness.
// 0.0 = at bg, 1.0 = at step 9.
// Dark: decelerating curve — big initial jump from bg, finer gradations near step 9.
export const DARK_STEP_POSITIONS: Record<number, number> = {
  1: 0.02, 2: 0.03, 3: 0.08, 4: 0.12,
  5: 0.16, 6: 0.30, 7: 0.40, 8: 0.50,
};
// Light: accelerating curve — subtle near bg (white), bigger jumps toward step 9.
export const LIGHT_STEP_POSITIONS: Record<number, number> = {
  1: 0.050, 2: 0.080, 3: 0.200, 4: 0.300,
  5: 0.400, 6: 0.600, 7: 0.650, 8: 0.700,
};

// Compute lightness for all 12 steps.
//
// Steps 1-8: interpolated in L³ space (≈ relative luminance Y) for
// perceptually uniform contrast across different background lightness levels.
// Weber's law: ΔY/Y = const → equal perceived contrast at any bg.
// Steps 9-10: fixed (brand colors).
// Steps 11-12: fixed (relative to step 9).
function computeUnifiedSteps(
  bgL: number,
  step9L: number,
  step10L: number,
  step11L: number,
  step12L: number,
  isDark: boolean,
  customPositions?: Record<number, number>,
): Record<number, number> {
  // Interpolate in L³ space (≈ luminance Y) for perceptually uniform steps.
  // L³ approximates relative luminance; interpolating here means equal
  // Weber contrast ratios regardless of background lightness.
  const bgY = bgL * bgL * bgL;
  const s9Y = step9L * step9L * step9L;
  const rangeY = isDark ? (s9Y - bgY) : (bgY - s9Y);

  // Steps 1-8: proportional fractions in Y space, converted back to L
  const positions = customPositions ?? (isDark ? DARK_STEP_POSITIONS : LIGHT_STEP_POSITIONS);
  const result: Record<number, number> = {};
  for (let step = 1; step <= 8; step++) {
    const offsetY = positions[step] * rangeY;
    const targetY = isDark ? bgY + offsetY : bgY - offsetY;
    result[step] = Math.cbrt(Math.max(0, targetY));
  }

  // Fixed anchors (positions 9-12 are L offsets from algorithmic defaults)
  result[9] = positions[9] !== undefined ? step9L + positions[9] : step9L;
  result[10] = positions[10] !== undefined ? step10L + positions[10] : step10L;
  result[11] = positions[11] !== undefined ? step11L + positions[11] : step11L;
  result[12] = positions[12] !== undefined ? step12L + positions[12] : step12L;

  // Wall compression — only for fixed anchors (steps 11-12 relative to 10)
  const MIN_GAP = 0.003;
  if (isDark) {
    if (result[11] <= result[10] + MIN_GAP) result[11] = result[10] + MIN_GAP;
    if (result[12] <= result[11] + MIN_GAP) result[12] = result[11] + MIN_GAP;
  } else {
    if (result[11] >= result[10] - MIN_GAP) result[11] = result[10] - MIN_GAP;
    if (result[12] >= result[11] - MIN_GAP) result[12] = result[11] - MIN_GAP;
  }

  // Clamp
  const maxL = isDark ? 0.97 : 0.995;
  for (let step = 1; step <= 12; step++) {
    if (step === 9 || step === 10) continue;
    result[step] = Math.max(0, Math.min(maxL, result[step]));
  }

  return result;
}

// Check if background causes step compression (steps overflowing into step 9).
// Compares min delta at actual bg vs reference bg.
export function checkBackgroundCompression(
  bgL: number,
  theme: 'light' | 'dark',
  step9L: number = LIGHT_STEP9_BASE_L,
): { compressed: boolean } {
  if (theme === 'light') return { compressed: false };

  const step10L = step9L + 0.039;
  const step11L = step9L + 0.115;

  const refSteps = computeUnifiedSteps(0, step9L, step10L, step11L, DARK_STEP12_L, true);
  const actualSteps = computeUnifiedSteps(bgL, step9L, step10L, step11L, DARK_STEP12_L, true);

  // Min delta between consecutive steps 5-9 at reference
  let minRefDelta = 1;
  for (let s = 5; s <= 8; s++) {
    const d = refSteps[s + 1] - refSteps[s];
    if (d < minRefDelta) minRefDelta = d;
  }

  // Min delta at actual bg
  let minActualDelta = 1;
  for (let s = 5; s <= 8; s++) {
    const d = actualSteps[s + 1] - actualSteps[s];
    if (d < minActualDelta) minActualDelta = d;
  }

  return { compressed: minActualDelta < minRefDelta * 0.5 };
}

// Reference lightness values
const LIGHT_STEP9_BASE_L = 0.644;
export const LIGHT_STEP12_L = 0.329;
export const DARK_STEP12_L = 0.930;

/** Compute default L values for steps 9-12 given step9L and theme */
export function computeDefaultStep9to12L(
  step9L: number,
  isDark: boolean,
): { 9: number; 10: number; 11: number; 12: number } {
  if (isDark) {
    return {
      9: step9L,
      10: step9L + 0.039,
      11: step9L + 0.115,
      12: DARK_STEP12_L,
    };
  }
  const baseStep11Drop = 0.093;
  const extraDrop = Math.max(0, step9L - LIGHT_STEP9_BASE_L) * 1.15;
  return {
    9: step9L,
    10: step9L - 0.028,
    11: step9L - baseStep11Drop - extraDrop,
    12: LIGHT_STEP12_L,
  };
}

// Find the L where max chroma occurs for this hue in sRGB.
// This determines whether the scale is "bright" (like amber, teal, lime)
// or "standard" (like blue, red).
function optimalLightnessForHue(hue: number, gamut: 'sRGB' | 'P3'): number {
  let bestL = 0.644;
  let bestC = 0;
  // Scan from L=0.30 to L=0.95 in 0.01 steps
  for (let l = 30; l <= 95; l++) {
    const c = maxChromaForLH(l / 100, hue, gamut);
    if (c > bestC) {
      bestC = c;
      bestL = l / 100;
    }
  }
  return bestL;
}

// Determine step 9 lightness for a given hue.
// Blends between the base L (0.644) and the optimal L for max chroma.
// For "standard" hues (blue, red) where optimal L ≈ 0.64, no change.
// For "bright" hues (teal, amber) where optimal L ≈ 0.85+, step 9 is boosted.
export function computeStep9Lightness(hue: number, gamut: 'sRGB' | 'P3'): number {
  const baseL = LIGHT_STEP9_BASE_L; // 0.644
  const optimalL = optimalLightnessForHue(hue, gamut);

  if (optimalL <= baseL + 0.05) {
    // Standard hue — optimal L is close to base, no boost needed
    return baseL;
  }

  // Bright hue — blend toward optimal L.
  // Blend factor: how much to shift toward optimal.
  // 0.85 = aggressive (Radix-like), leaves some room to not overshoot.
  const blendFactor = 0.85;
  return baseL + (optimalL - baseL) * blendFactor;
}

// Chroma distribution — matches actual Radix Colors pattern.
// Default curve (blue, green, red average):
//   Radix avg: 2%, 6%, 15%, 25%, 34%, 44%, 55%, 74%, 100%, 96%, 88%, 46%
const CHROMA_FACTORS: Record<StepIndex, number> = {
  1: 0.02,
  2: 0.06,
  3: 0.15,
  4: 0.25,
  5: 0.34,
  6: 0.44,
  7: 0.55,
  8: 0.74,
  9: 1.00,
  10: 0.96,
  11: 0.88,
  12: 0.46,
};

// "Bright" scales (amber, teal, lime, etc.) have higher chroma at early steps.
// Radix amber pattern: 2%, 15%, 44%, 66%, 84%, 78%, 78%, 89%, 100%, 107%, 82%, 31%
const BRIGHT_CHROMA_FACTORS: Record<StepIndex, number> = {
  1: 0.02,
  2: 0.15,
  3: 0.44,
  4: 0.66,
  5: 0.84,
  6: 0.78,
  7: 0.78,
  8: 0.89,
  9: 1.00,
  10: 1.05,
  11: 0.82,
  12: 0.31,
};

// How "bright" a scale is (0 = standard, 1 = fully bright)
// based on how much step 9 L was boosted above the base.
function brightnessBlend(step9L: number): number {
  const baseL = LIGHT_STEP9_BASE_L; // 0.644
  const maxBoost = 0.25; // At this boost, fully bright curve
  const boost = Math.max(0, step9L - baseL);
  return Math.min(1, boost / maxBoost);
}

function chromaForStep(step: StepIndex, peakChroma: number, step9L: number): number {
  const bright = brightnessBlend(step9L);
  if (bright <= 0) return peakChroma * CHROMA_FACTORS[step];

  const defaultF = CHROMA_FACTORS[step];
  const brightF = BRIGHT_CHROMA_FACTORS[step];
  const factor = defaultF + (brightF - defaultF) * bright;
  return peakChroma * factor;
}

// Chroma for neutral scales (very low, nearly uniform)
function neutralChromaForStep(step: StepIndex, neutralChroma: number): number {
  const t = (step - 1) / 11;
  const bump = 1 + 0.15 * 4 * t * (1 - t);
  return neutralChroma * bump;
}

export interface ScaleGeneratorOptions {
  hue: number;
  peakChroma: number;
  gamut: 'sRGB' | 'P3';
  fixedStep9?: OklchColor; // Lock step 9 to exact brand color
  isNeutral?: boolean;
  /** Contrast-neutral mode: force step 9 to pure black (light) / white (dark) and step 10 to 30% of step 9 in OKLCH. Only honoured when isNeutral=true. */
  contrastNeutral?: boolean;
  brandLightness?: number; // Brand step 9 L — semantics shift toward it
  brandChromaCeiling?: number; // Max chroma from user's brand (dark adaptive mode)
  backgroundLightness?: number; // L of background color (both themes)
  stepPositions?: Record<number, number>; // Custom step 1-8 position fractions
  forcedStep9L?: number; // Override step 9 L (for equalize lightness mode)
}

// Generate a 12-step OKLCH scale for light theme
export function generateLightThemeScale(options: ScaleGeneratorOptions): {
  oklchScale: OklchScale;
  hexScale: ColorScale;
  defaultStep9L: number;
} {
  const { hue, peakChroma, gamut, fixedStep9, isNeutral = false, contrastNeutral = false, brandLightness, backgroundLightness, stepPositions, forcedStep9L } = options;

  // Background lightness — default to reference
  const bgL = backgroundLightness ?? 1.0;

  const oklchScale = {} as OklchScale;
  const hexScale = {} as ColorScale;

  // Determine step 9 lightness
  let step9L: number;
  let step9C: number;

  if (forcedStep9L !== undefined && !fixedStep9) {
    // Equalize lightness mode — use brand's step 9 L for all roles
    step9L = forcedStep9L;
    step9C = peakChroma;
  } else if (fixedStep9) {
    step9L = fixedStep9.l;
    step9C = fixedStep9.c;
  } else {
    let baseL = isNeutral
      ? LIGHT_STEP9_BASE_L
      : computeStep9Lightness(hue, gamut);

    // Shift semantic roles toward brand lightness (attenuated for extreme brands)
    if (brandLightness !== undefined && !isNeutral) {
      const deviation = Math.abs(brandLightness - baseL);
      const blendFactor = deviation > 0.15
        ? 0.35 * (0.15 / deviation)
        : 0.35;
      baseL = baseL + (brandLightness - baseL) * blendFactor;
      baseL = Math.max(0.55, Math.min(0.85, baseL));
    }

    step9L = baseL;
    step9C = peakChroma;
  }

  // Steps 10, 11 relative to step 9 (Radix pattern)
  const step10L = step9L - 0.028;
  const baseStep11Drop = 0.093;
  const extraDrop = Math.max(0, step9L - LIGHT_STEP9_BASE_L) * 1.15;
  const step11L = step9L - baseStep11Drop - extraDrop;

  // Unified step computation
  // When fixedStep9 is set, strip step 9 override so brand L is preserved
  const effectivePositions = fixedStep9 && stepPositions?.[9] !== undefined
    ? (({ 9: _, ...rest }) => rest)(stepPositions) as Record<number, number>
    : stepPositions;
  const finalL = computeUnifiedSteps(bgL, step9L, step10L, step11L, LIGHT_STEP12_L, false, effectivePositions);

  for (const step of STEP_INDICES) {
    // Contrast neutral is applied here as a *post-hoc override* on steps 9/10
    // only. We do NOT feed L=0 back into computeUnifiedSteps — that would
    // reshape the entire curve. Steps 1-8 and 11-12 stay on the regular path.
    let l = finalL[step];
    let c: number;
    if (isNeutral && contrastNeutral && step === 9) {
      l = 0;
      c = 0;
    } else if (isNeutral && contrastNeutral && step === 10) {
      l = 0.3;
      c = 0;
    } else if (step === 9) {
      c = step9C;
    } else if (isNeutral) {
      c = neutralChromaForStep(step, peakChroma);
    } else {
      c = chromaForStep(step, peakChroma, step9L);
    }

    const mapped = gamutMapOklch({ l, c, h: hue }, gamut);
    oklchScale[step] = mapped.oklch;
    hexScale[step] = mapped.hex;
  }

  return { oklchScale, hexScale, defaultStep9L: step9L };
}

// Dark mode chroma — aligned with Radix Colors pattern.
// Steps 3-6 have significantly higher chroma than light theme to compensate for
// Hunt effect (dark backgrounds reduce perceived saturation) and provide
// rich, saturated colors at surface/border steps.
// Step 9: used directly from step9C, factor below is unused.
const DARK_CHROMA_FACTORS: Record<StepIndex, number> = {
  1: 0.10,
  2: 0.16,
  3: 0.35,
  4: 0.48,
  5: 0.55,
  6: 0.58,
  7: 0.63,
  8: 0.80,
  9: 0.85,
  10: 0.80,
  11: 0.65,
  12: 0.24,
};

function darkChromaForStep(step: StepIndex, peakChroma: number): number {
  return peakChroma * DARK_CHROMA_FACTORS[step];
}

// Generate a 12-step OKLCH scale for dark theme
export function generateDarkThemeScale(options: ScaleGeneratorOptions): {
  oklchScale: OklchScale;
  hexScale: ColorScale;
  defaultStep9L: number;
} {
  const { hue, peakChroma, gamut, fixedStep9, isNeutral = false, contrastNeutral = false, brandLightness, brandChromaCeiling, backgroundLightness, stepPositions, forcedStep9L } = options;

  const oklchScale = {} as OklchScale;
  const hexScale = {} as ColorScale;

  // Background lightness — default to reference
  const bgL = backgroundLightness ?? 0.178;

  // Step 9 lightness: same logic as light (hue-dependent)
  let step9L: number;
  let step9C: number;

  if (forcedStep9L !== undefined && !fixedStep9) {
    // Equalize lightness mode — use brand's step 9 L for all roles
    step9L = forcedStep9L;
    step9C = brandChromaCeiling !== undefined
      ? Math.min(peakChroma, brandChromaCeiling * 0.85)
      : peakChroma;
  } else if (fixedStep9) {
    step9L = fixedStep9.l;
    step9C = fixedStep9.c;
  } else {
    let baseL = isNeutral
      ? LIGHT_STEP9_BASE_L
      : computeStep9Lightness(hue, gamut);

    // Attenuated blend for extreme brand lightness values
    if (brandLightness !== undefined && !isNeutral) {
      const deviation = Math.abs(brandLightness - baseL);
      const blendFactor = deviation > 0.15
        ? 0.35 * (0.15 / deviation)
        : 0.35;
      baseL = baseL + (brandLightness - baseL) * blendFactor;
      baseL = Math.max(0.55, Math.min(0.85, baseL));
    }

    step9L = baseL;
    // In adaptive dark mode, cap chroma to user's brand chroma with H-K compensation
    step9C = brandChromaCeiling !== undefined
      ? Math.min(peakChroma, brandChromaCeiling * 0.85)
      : peakChroma;
  }

  // In dark mode: hover is lighter, text steps are high-lightness
  const step10L = step9L + 0.039;
  const step11L = step9L + 0.115;

  // Unified step computation
  const effectivePositions = fixedStep9 && stepPositions?.[9] !== undefined
    ? (({ 9: _, ...rest }) => rest)(stepPositions) as Record<number, number>
    : stepPositions;
  const finalL = computeUnifiedSteps(bgL, step9L, step10L, step11L, DARK_STEP12_L, true, effectivePositions);

  for (const step of STEP_INDICES) {
    // Contrast neutral applied as a post-hoc override on steps 9/10 only —
    // mirror of the light-theme treatment. Steps 1-8 and 11-12 stay on the
    // regular dark-mode curve.
    let l = finalL[step];
    let c: number;
    if (isNeutral && contrastNeutral && step === 9) {
      l = 1;
      c = 0;
    } else if (isNeutral && contrastNeutral && step === 10) {
      l = 0.7;
      c = 0;
    } else if (step === 9) {
      c = step9C;
    } else if (isNeutral) {
      c = neutralChromaForStep(step, peakChroma);
    } else {
      c = darkChromaForStep(step, peakChroma);
    }

    const mapped = gamutMapOklch({ l, c, h: hue }, gamut);
    oklchScale[step] = mapped.oklch;
    hexScale[step] = mapped.hex;
  }

  return { oklchScale, hexScale, defaultStep9L: step9L };
}
