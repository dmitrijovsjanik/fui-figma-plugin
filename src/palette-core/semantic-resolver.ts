import type { SemanticHues, NeutralStyle, SemanticHarmonyConfig, HarmonyType } from './types';

// Target hues for each semantic role
const TARGET_HUES = {
  success: 145,
  warning: 80,
  danger: 25,
  info: 245,
} as const;

// Valid ranges for each role — widened to allow stronger harmony pull
const HUE_RANGES = {
  success: { min: 120, max: 165 },
  warning: { min: 55, max: 95 },
  danger: { min: 10, max: 40 },
  info: { min: 220, max: 265 },
} as const;

// Minimum angular distance between any two semantic hues
const MIN_SEMANTIC_DISTANCE = 25;

// Angular distance on the hue circle (0-180)
function angularDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Clamp hue to a range
function clampHue(h: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, h));
}

// Sign of the shortest path from source to target on the hue circle
function hueDirection(from: number, to: number): number {
  const diff = ((to - from) % 360 + 360) % 360;
  return diff <= 180 ? 1 : -1;
}

// Nonlinear pull curve — stronger pull for mid-range distances,
// tapering off for very close and very distant hues
function harmonyPullStrength(brandDistance: number): number {
  // Max pull = 18°. Curve: rises from 0 at distance=30, peaks ~120°, tapers off
  // Uses a smoothstep-like function for natural feel
  if (brandDistance <= 30) return 0; // Inside conflict zone, handled by push
  const t = Math.min(1, (brandDistance - 30) / 120); // 0-1 over 30°-150° range
  const smooth = t * t * (3 - 2 * t); // smoothstep
  return 18 * smooth;
}

// Compute harmonic anchor points on the hue wheel for a given harmony type
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function computeHarmonicAnchors(brandHue: number, harmonyType: HarmonyType): number[] {
  switch (harmonyType) {
    case 'complementary':
      return [brandHue, normalizeHue(brandHue + 180)];
    case 'analogous':
      return [normalizeHue(brandHue - 30), brandHue, normalizeHue(brandHue + 30)];
    case 'triadic':
      return [brandHue, normalizeHue(brandHue + 120), normalizeHue(brandHue + 240)];
    case 'split-complementary':
      return [brandHue, normalizeHue(brandHue + 150), normalizeHue(brandHue + 210)];
    case 'tetradic':
      return [brandHue, normalizeHue(brandHue + 90), normalizeHue(brandHue + 180), normalizeHue(brandHue + 270)];
  }
}

function findNearestAnchor(hue: number, anchors: number[]): number {
  let best = anchors[0];
  let bestDist = angularDistance(hue, anchors[0]);
  for (let i = 1; i < anchors.length; i++) {
    const d = angularDistance(hue, anchors[i]);
    if (d < bestDist) {
      bestDist = d;
      best = anchors[i];
    }
  }
  return best;
}

export function resolveSemanticHues(
  brandHue: number,
  neutralStyle: NeutralStyle = 'tinted',
  secondaryHue?: number,
  semanticHarmony?: SemanticHarmonyConfig,
): SemanticHues {
  const result: Partial<SemanticHues> = {
    brand: brandHue,
    secondary: secondaryHue ?? brandHue,
  };

  const semanticRoles = Object.keys(TARGET_HUES) as (keyof typeof TARGET_HUES)[];

  // Phase 1: Compute initial adjusted hues (brand/secondary conflict + harmony pull)
  const adjusted: Record<keyof typeof TARGET_HUES, number> = {} as any;

  for (const role of semanticRoles) {
    const target = TARGET_HUES[role];
    const range = HUE_RANGES[role];
    const brandDistance = angularDistance(brandHue, target);
    const secondaryDistance = secondaryHue !== undefined
      ? angularDistance(secondaryHue, target)
      : Infinity;

    const closestHue = brandDistance <= secondaryDistance ? brandHue : secondaryHue!;
    const closestDistance = Math.min(brandDistance, secondaryDistance);

    let adjustedHue: number;

    const harmonyActive = semanticHarmony && semanticHarmony.mode !== 'off' && semanticHarmony.strength > 0;

    if (closestDistance < 30) {
      // Reserved hue (brand or secondary) is too close — push semantic hue away
      const pushStrength = (30 - closestDistance) * 0.6;
      const direction = hueDirection(closestHue, target);
      adjustedHue = target + pushStrength * direction;
    } else if (harmonyActive) {
      // Defer pulling to Phase 1.5 (harmonic anchor pull)
      adjustedHue = target;
    } else {
      // Pull toward brand for harmony — nonlinear, stronger pull
      const pullStrength = harmonyPullStrength(brandDistance);
      const direction = hueDirection(target, brandHue);
      adjustedHue = target + pullStrength * direction;
    }

    adjusted[role] = clampHue(adjustedHue, range.min, range.max);
  }

  // Phase 1.5: Harmonic anchor pull (only if semantic harmony is active)
  if (semanticHarmony && semanticHarmony.mode !== 'off' && semanticHarmony.strength > 0) {
    const anchors = computeHarmonicAnchors(brandHue, semanticHarmony.harmonyType);
    const MAX_HARMONIC_PULL = 25;

    for (const role of semanticRoles) {
      const range = HUE_RANGES[role];
      const currentHue = adjusted[role];
      const nearestAnchor = findNearestAnchor(currentHue, anchors);
      const distance = angularDistance(currentHue, nearestAnchor);

      if (distance < 2) continue; // Already aligned

      const pullFraction = Math.min(1, distance / 60);
      const pullAmount = semanticHarmony.strength * MAX_HARMONIC_PULL * pullFraction;
      const direction = hueDirection(currentHue, nearestAnchor);

      adjusted[role] = clampHue(currentHue + pullAmount * direction, range.min, range.max);
    }
  }

  // Phase 2: Mutual repulsion — ensure semantic hues don't crowd each other
  // Iterate a few times to let repulsion settle
  for (let iteration = 0; iteration < 3; iteration++) {
    for (let i = 0; i < semanticRoles.length; i++) {
      for (let j = i + 1; j < semanticRoles.length; j++) {
        const roleA = semanticRoles[i];
        const roleB = semanticRoles[j];
        const dist = angularDistance(adjusted[roleA], adjusted[roleB]);

        if (dist < MIN_SEMANTIC_DISTANCE) {
          const rangeA = HUE_RANGES[roleA];
          const rangeB = HUE_RANGES[roleB];
          // Push each hue away from the other, respecting ranges
          const pushAmount = (MIN_SEMANTIC_DISTANCE - dist) / 2;
          const dir = hueDirection(adjusted[roleB], adjusted[roleA]);
          adjusted[roleA] = clampHue(adjusted[roleA] + pushAmount * dir, rangeA.min, rangeA.max);
          adjusted[roleB] = clampHue(adjusted[roleB] - pushAmount * dir, rangeB.min, rangeB.max);
        }
      }
    }
  }

  // Write final values
  for (const role of semanticRoles) {
    result[role] = adjusted[role];
  }

  // Neutral hue
  result.neutral = neutralStyle === 'tinted' ? brandHue : 0;

  return result as SemanticHues;
}
