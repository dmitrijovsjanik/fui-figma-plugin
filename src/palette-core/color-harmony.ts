import type { HarmonyType, HarmonyVariation, SecondaryConfig } from './types';

const HARMONY_ANGLES: Record<HarmonyType, { positive: number; negative: number }> = {
  'complementary':       { positive: 180, negative: 180 },
  'analogous':           { positive: 30,  negative: -30 },
  'triadic':             { positive: 120, negative: -120 },
  'split-complementary': { positive: 150, negative: -150 },
  'tetradic':            { positive: 90,  negative: -90 },
};

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function resolveSecondaryHue(
  brandHue: number,
  config: SecondaryConfig,
): number {
  if (config.mode === 'off') return brandHue;

  const angles = HARMONY_ANGLES[config.harmonyType];
  const offset = config.harmonyVariation === 'positive' ? angles.positive : angles.negative;
  return normalizeHue(brandHue + offset);
}

export function getHarmonyVariations(harmonyType: HarmonyType): HarmonyVariation[] {
  if (harmonyType === 'complementary') return ['positive'];
  return ['positive', 'negative'];
}

export function getHarmonyLabel(harmonyType: HarmonyType, variation: HarmonyVariation): string {
  const angles = HARMONY_ANGLES[harmonyType];
  const offset = variation === 'positive' ? angles.positive : angles.negative;
  const sign = offset >= 0 ? '+' : '';
  return `${sign}${offset}\u00B0`;
}
