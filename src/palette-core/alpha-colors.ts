import type { HexColor, AlphaColor, AlphaColorScale, ColorScale, StepIndex } from './types';
import { STEP_INDICES } from './types';
import { colorToRGB, colorToFloatComponents } from './gamut-mapper';

// Minimum-alpha algorithm: find the lowest possible alpha where the
// overlay color stays within gamut [0,1]. This produces maximally
// transparent colors that blend well — matching Radix Colors behavior.

function solveAlphaFloat(
  sc: [number, number, number],
  bc: [number, number, number],
): { c: [number, number, number]; a: number } {
  const EPS = 1e-6;

  if (Math.abs(sc[0] - bc[0]) < EPS && Math.abs(sc[1] - bc[1]) < EPS && Math.abs(sc[2] - bc[2]) < EPS) {
    return { c: [0, 0, 0], a: 0 };
  }

  // Minimum alpha per channel so that overlay = (S - B*(1-a)) / a stays in [0,1]
  const minAlphas = sc.map((s, i) => {
    const b = bc[i];
    if (Math.abs(s - b) < EPS) return 0;
    if (s > b) return (1 - b) < EPS ? 1 : (s - b) / (1 - b);
    return b < EPS ? 1 : (b - s) / b;
  });

  let a = Math.max(...minAlphas);
  a = Math.min(1, Math.max(EPS, a));
  a = Math.round(a * 1000) / 1000;

  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    c[i] = Math.min(1, Math.max(0, (sc[i] - bc[i] * (1 - a)) / a));
  }

  return { c, a };
}

// Given a solid target color and a background, find the semi-transparent
// color that composites to the same visual result over that background.
// Uses minimum-alpha approach: finds the lowest alpha where overlay stays
// within gamut, producing maximally transparent colors that blend well.
//
// For sRGB: works in 0-255 integer space, outputs rgba().
// For P3: works in 0-1 float space, outputs color(display-p3 r g b / a).
export function computeAlphaColor(
  solidColor: string,
  backgroundHex: HexColor,
  gamut: 'sRGB' | 'P3' = 'sRGB',
): AlphaColor {
  const isP3 = gamut === 'P3' && solidColor.startsWith('color(');

  if (isP3) {
    // P3 path: work in native P3 float space (0-1)
    const sc = colorToFloatComponents(solidColor);
    const bc = colorToFloatComponents(backgroundHex);
    const { c, a } = solveAlphaFloat(sc, bc);

    if (a === 0) {
      return { r: 0, g: 0, b: 0, a: 0, css: 'color(display-p3 0 0 0 / 0)' };
    }

    // Round overlay components to 4 decimal places for CSS
    const r4 = Math.round(c[0] * 10000) / 10000;
    const g4 = Math.round(c[1] * 10000) / 10000;
    const b4 = Math.round(c[2] * 10000) / 10000;

    return {
      // r,g,b as 0-255 sRGB approximation (for legacy consumers like SVG export)
      r: Math.round(c[0] * 255),
      g: Math.round(c[1] * 255),
      b: Math.round(c[2] * 255),
      a,
      css: `color(display-p3 ${r4} ${g4} ${b4} / ${a})`,
    };
  }

  // sRGB path: work in 0-255 integer space
  const [sr, sg, sb] = colorToRGB(solidColor);
  const [br, bg, bb] = colorToRGB(backgroundHex);

  if (sr === br && sg === bg && sb === bb) {
    return { r: 0, g: 0, b: 0, a: 0, css: 'rgba(0, 0, 0, 0)' };
  }

  const channels: [number, number][] = [[sr, br], [sg, bg], [sb, bb]];

  // Minimum alpha per channel so that overlay = (S - B*(1-a)) / a stays in [0,255]
  const minAlphas = channels.map(([s, b]) => {
    if (s === b) return 0;
    if (s > b) return b === 255 ? 1 : (s - b) / (255 - b);
    return b === 0 ? 1 : (b - s) / b;
  });

  let a = Math.max(...minAlphas);
  a = Math.min(1, Math.max(1 / 255, a));
  a = Math.round(a * 1000) / 1000;

  const cr = Math.round(Math.min(255, Math.max(0, (sr - br * (1 - a)) / a)));
  const cg = Math.round(Math.min(255, Math.max(0, (sg - bg * (1 - a)) / a)));
  const cb = Math.round(Math.min(255, Math.max(0, (sb - bb * (1 - a)) / a)));

  return {
    r: cr,
    g: cg,
    b: cb,
    a,
    css: `rgba(${cr}, ${cg}, ${cb}, ${a})`,
  };
}

// Compute alpha equivalents for an entire 12-step scale
export function computeAlphaScale(
  solidScale: ColorScale,
  backgroundHex: HexColor,
  gamut: 'sRGB' | 'P3' = 'sRGB',
): AlphaColorScale {
  const result = {} as AlphaColorScale;
  for (const step of STEP_INDICES) {
    result[step] = computeAlphaColor(solidScale[step], backgroundHex, gamut);
  }
  return result;
}
