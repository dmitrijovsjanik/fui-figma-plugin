import type { OklchColor, HexColor } from './types';
import { converter } from 'culori';

// --- Low-level math ---

function inGamut01(r: number, g: number, b: number): boolean {
  const eps = 1e-6;
  return r >= -eps && r <= 1 + eps &&
         g >= -eps && g <= 1 + eps &&
         b >= -eps && b <= 1 + eps;
}

function linToSRGB(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function rgbToHex(r: number, g: number, b: number): HexColor {
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return '#' + [R, G, B].map(v => v.toString(16).padStart(2, '0')).join('');
}

// OKLab from OKLCH
function oklchToOklab(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// OKLab -> LMS cubed
function oklabToLMS3(L: number, a: number, b: number): [number, number, number] {
  const L_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const M_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const S_ = L - 0.0894841775 * a - 1.2914855480 * b;
  return [L_ * L_ * L_, M_ * M_ * M_, S_ * S_ * S_];
}

// LMS3 -> linear sRGB
function lms3ToLinearSRGB(L3: number, M3: number, S3: number): [number, number, number] {
  return [
    +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3,
    -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3,
    -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3,
  ];
}

// LMS3 -> linear Display P3
// Matrix: XYZ_to_P3 * LMS3_to_XYZ (derived from OKLab spec)
function lms3ToLinearP3(L3: number, M3: number, S3: number): [number, number, number] {
  return [
    +3.1277687619 * L3 - 2.2571279789 * M3 + 0.1293592170 * S3,
    -1.0910090184 * L3 + 2.4133195461 * M3 - 0.3223105278 * S3,
    -0.0260759651 * L3 - 0.7034884457 * M3 + 1.7295644108 * S3,
  ];
}

// OKLCH -> linear sRGB
function oklchToLinearSRGB(L: number, C: number, hDeg: number): [number, number, number] {
  const [l, a, b] = oklchToOklab(L, C, hDeg);
  const [L3, M3, S3] = oklabToLMS3(l, a, b);
  return lms3ToLinearSRGB(L3, M3, S3);
}

// OKLCH -> linear Display P3
function oklchToLinearP3(L: number, C: number, hDeg: number): [number, number, number] {
  const [l, a, b] = oklchToOklab(L, C, hDeg);
  const [L3, M3, S3] = oklabToLMS3(l, a, b);
  return lms3ToLinearP3(L3, M3, S3);
}

// OKLCH -> linear RGB for the specified gamut
function oklchToLinearRGB(L: number, C: number, hDeg: number, gamut: 'sRGB' | 'P3' = 'sRGB'): [number, number, number] {
  return gamut === 'P3'
    ? oklchToLinearP3(L, C, hDeg)
    : oklchToLinearSRGB(L, C, hDeg);
}

// Display P3 uses the same transfer function as sRGB
function linToGamma(x: number): number {
  return linToSRGB(x);
}

// Format a P3 color as CSS color(display-p3 r g b)
function p3ToCss(r: number, g: number, b: number): string {
  const R = clamp01(linToGamma(r));
  const G = clamp01(linToGamma(g));
  const B = clamp01(linToGamma(b));
  return `color(display-p3 ${R.toFixed(4)} ${G.toFixed(4)} ${B.toFixed(4)})`;
}

// Convert OKLCH to a CSS color string.
// sRGB -> hex (#rrggbb), P3 -> color(display-p3 r g b)
// Returns null if out of gamut.
export function oklchToColor(l: number, c: number, hDeg: number, gamut: 'sRGB' | 'P3' = 'sRGB'): string | null {
  const [r, g, b] = oklchToLinearRGB(l, c, hDeg, gamut);
  if (!inGamut01(r, g, b)) return null;

  if (gamut === 'P3') {
    return p3ToCss(r, g, b);
  }

  const sr = linToSRGB(r);
  const sg = linToSRGB(g);
  const sb = linToSRGB(b);
  if (!isFinite(sr) || !isFinite(sg) || !isFinite(sb)) return null;
  return rgbToHex(clamp01(sr), clamp01(sg), clamp01(sb));
}

// Legacy alias — sRGB only
export function oklchToHex(l: number, c: number, hDeg: number): HexColor | null {
  return oklchToColor(l, c, hDeg, 'sRGB');
}

// Convert OKLCH to CSS color with gamut mapping (binary search chroma reduction).
// Always returns a valid color string.
export function oklchToColorClamped(l: number, c: number, hDeg: number, gamut: 'sRGB' | 'P3' = 'sRGB'): string {
  let color = oklchToColor(l, c, hDeg, gamut);
  if (color) return color;

  // Binary search: reduce chroma to fit gamut
  let lo = 0, hi = c;
  let attempts = 18;
  while (attempts-- > 0) {
    const mid = (lo + hi) / 2;
    const candidate = oklchToColor(l, mid, hDeg, gamut);
    if (candidate) {
      color = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return color || oklchToColor(l, 0, hDeg, gamut) || (gamut === 'P3' ? 'color(display-p3 0 0 0)' : '#000000');
}

// Legacy alias — sRGB only
export function oklchToHexClamped(l: number, c: number, hDeg: number): HexColor {
  return oklchToColorClamped(l, c, hDeg, 'sRGB');
}

// Check if an OKLCH color is within the specified gamut
export function isInGamut(color: OklchColor, gamut: 'sRGB' | 'P3' = 'sRGB'): boolean {
  const [r, g, b] = oklchToLinearRGB(color.l, color.c, color.h, gamut);
  return inGamut01(r, g, b);
}

// Gamut map an OKLCH color: reduce chroma to fit gamut, return both OKLCH and color string
export function gamutMapOklch(
  color: OklchColor,
  gamut: 'sRGB' | 'P3' = 'sRGB'
): { oklch: OklchColor; hex: HexColor } {
  const hex = oklchToColorClamped(color.l, color.c, color.h, gamut);

  if (isInGamut(color, gamut)) {
    return { oklch: { ...color }, hex };
  }

  // Binary search for max chroma at this L, H within gamut
  let lo = 0, hi = color.c;
  let bestC = 0;
  let attempts = 18;
  while (attempts-- > 0) {
    const mid = (lo + hi) / 2;
    const [r, g, b] = oklchToLinearRGB(color.l, mid, color.h, gamut);
    if (inGamut01(r, g, b)) {
      bestC = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    oklch: { l: color.l, c: bestC, h: color.h },
    hex,
  };
}

// Find the maximum chroma for a given lightness and hue within the gamut.
export function maxChromaForLH(l: number, h: number, gamut: 'sRGB' | 'P3' = 'sRGB'): number {
  let lo = 0, hi = 0.4; // OKLCH chroma max ~0.4
  let bestC = 0;
  let attempts = 20;

  while (attempts-- > 0) {
    const mid = (lo + hi) / 2;
    const [r, g, b] = oklchToLinearRGB(l, mid, h, gamut);
    if (inGamut01(r, g, b)) {
      bestC = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return bestC;
}

// Parse any CSS color string (hex or display-p3) to sRGB [0-255].
// Handles: #rrggbb, color(display-p3 r g b)
// P3 values are clamped to sRGB range (may lose out-of-sRGB-gamut data).
const P3_RE = /^color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/;

export function colorToRGB(color: string): [number, number, number] {
  const p3 = P3_RE.exec(color);
  if (p3) {
    // P3 gamma values (0-1) — same transfer function as sRGB
    // Clamp to 0-255 sRGB range
    return [
      Math.round(clamp01(parseFloat(p3[1])) * 255),
      Math.round(clamp01(parseFloat(p3[2])) * 255),
      Math.round(clamp01(parseFloat(p3[3])) * 255),
    ];
  }
  // Hex fallback
  const h = color.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Parse a color string to gamma-encoded float [0-1] components in its native space.
// For hex: returns sRGB gamma components (0-1).
// For color(display-p3 r g b): returns P3 gamma components (0-1).
export function colorToFloatComponents(color: string): [number, number, number] {
  const p3 = P3_RE.exec(color);
  if (p3) {
    return [parseFloat(p3[1]), parseFloat(p3[2]), parseFloat(p3[3])];
  }
  const h = color.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// Convert OKLCH to sRGB bytes [0-255] with gamut clamping.
// Out-of-gamut colors have chroma reduced via binary search.
// Returns [r, g, b] suitable for canvas ImageData.
export function oklchToRGB(l: number, c: number, hDeg: number, gamut: 'sRGB' | 'P3' = 'sRGB'): [number, number, number] {
  const toLinear = gamut === 'P3' ? oklchToLinearP3 : oklchToLinearSRGB;
  // Try direct conversion first
  let [lr, lg, lb] = toLinear(l, c, hDeg);
  if (!inGamut01(lr, lg, lb)) {
    // Binary search chroma reduction
    let lo = 0, hi = c;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const [r, g, b] = toLinear(l, mid, hDeg);
      if (inGamut01(r, g, b)) {
        lr = r; lg = g; lb = b;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }
  // Both sRGB and P3 use the same gamma transfer function
  return [
    Math.round(clamp01(linToSRGB(lr)) * 255),
    Math.round(clamp01(linToSRGB(lg)) * 255),
    Math.round(clamp01(linToSRGB(lb)) * 255),
  ];
}

// Parse HEX to OKLCH using culori (for input conversion)
const toOklch = converter('oklch');

export function hexToOklch(hex: HexColor): OklchColor {
  const result = toOklch(hex);
  if (!result) throw new Error(`Invalid color: ${hex}`);
  return {
    l: result.l ?? 0,
    c: result.c ?? 0,
    h: result.h ?? 0,
  };
}
