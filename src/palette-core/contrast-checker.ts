import type { HexColor, Palette, SemanticRole, StepIndex, ContrastResult, AccessibilityReport } from './types';
import { SEMANTIC_ROLES } from './types';
import { colorToRGB } from './gamut-mapper';

// --- WCAG 2.x Contrast ---

function parseRGB01(color: HexColor): [number, number, number] {
  const [r, g, b] = colorToRGB(color);
  return [r / 255, g / 255, b / 255];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function checkWCAGContrast(fg: HexColor, bg: HexColor): number {
  const [r1, g1, b1] = parseRGB01(fg);
  const [r2, g2, b2] = parseRGB01(bg);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- APCA Contrast (SA98G v0.0.98G-4g) ---
// Constants
const APCA_blkThrs = 0.022;
const APCA_blkClmp = 1.414;
const APCA_normBG = 0.56;
const APCA_normTXT = 0.57;
const APCA_revBG = 0.65;
const APCA_revTXT = 0.62;
const APCA_scaleBoW = 1.14;
const APCA_scaleWoB = 1.14;
const APCA_loBoWoffset = 0.027;
const APCA_loWoBoffset = 0.027;
const APCA_loClip = 0.1;

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function sRGBtoY(hex: HexColor): number {
  const [r, g, b] = parseRGB01(hex);
  return 0.2126729 * linearize(r) + 0.7151522 * linearize(g) + 0.0721750 * linearize(b);
}

export function softClampY(Y: number): number {
  return Y > APCA_blkThrs ? Y : Y + Math.pow(APCA_blkThrs - Y, APCA_blkClmp);
}

function unclampY(Yc: number): number {
  if (Yc >= APCA_blkThrs) return Yc;
  // Bisect: find Y in [0, 0.022] where softClampY(Y) = Yc
  let lo = 0, hi = APCA_blkThrs;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (softClampY(mid) < Yc) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// APCA Lc from raw luminance values. Returns absolute |Lc|.
export function apcaLcFromY(fgY: number, bgY: number): number {
  const fgYc = softClampY(fgY);
  const bgYc = softClampY(bgY);

  if (bgYc > fgYc) {
    // Normal polarity (dark on light)
    const SAPC = (Math.pow(bgYc, APCA_normBG) - Math.pow(fgYc, APCA_normTXT)) * APCA_scaleBoW;
    return SAPC < APCA_loClip ? 0 : (SAPC - APCA_loBoWoffset) * 100;
  } else {
    // Reverse polarity (light on dark)
    const SAPC = (Math.pow(bgYc, APCA_revBG) - Math.pow(fgYc, APCA_revTXT)) * APCA_scaleWoB;
    return SAPC > -APCA_loClip ? 0 : Math.abs((SAPC + APCA_loWoBoffset) * 100);
  }
}

// Reverse-solve APCA: given target |Lc| and background Y,
// find the foreground Y that achieves that contrast.
export function reverseAPCA(targetLc: number, bgY: number, polarity: 'normal' | 'reverse'): number {
  if (targetLc < 1) return bgY;

  const bgYc = softClampY(bgY);

  if (polarity === 'reverse') {
    // Dark background, lighter foreground
    // SAPC = -(targetLc / 100) - loWoBoffset
    // txtYc^revTXT = bgYc^revBG - SAPC / scaleWoB
    const SAPC = -(targetLc / 100) - APCA_loWoBoffset;
    const txtYcPow = Math.pow(bgYc, APCA_revBG) - SAPC / APCA_scaleWoB;
    if (txtYcPow <= 0) return 1.0;
    const txtYc = Math.pow(txtYcPow, 1.0 / APCA_revTXT);
    return Math.min(1.0, Math.max(0, unclampY(txtYc)));
  } else {
    // Light background, darker foreground
    // SAPC = (targetLc / 100) + loBoWoffset
    // txtYc^normTXT = bgYc^normBG - SAPC / scaleBoW
    const SAPC = (targetLc / 100) + APCA_loBoWoffset;
    const txtYcPow = Math.pow(bgYc, APCA_normBG) - SAPC / APCA_scaleBoW;
    if (txtYcPow <= 0) return 0;
    const txtYc = Math.pow(txtYcPow, 1.0 / APCA_normTXT);
    return Math.min(1.0, Math.max(0, unclampY(txtYc)));
  }
}

// Convenience: reverse-solve APCA returning OKLCH lightness.
// Uses achromatic approximation Y = L^3.
export function reverseAPCA_OklchL(targetLc: number, bgOklchL: number, polarity: 'normal' | 'reverse'): number {
  const bgY = bgOklchL * bgOklchL * bgOklchL;
  const fgY = reverseAPCA(targetLc, bgY, polarity);
  return Math.cbrt(fgY);
}

export function checkAPCAContrast(text: HexColor, bg: HexColor): number {
  const txtY = sRGBtoY(text);
  const bgY = sRGBtoY(bg);
  const txtYc = softClampY(txtY);
  const bgYc = softClampY(bgY);

  let SAPC: number;
  if (bgYc > txtYc) {
    // Normal polarity (dark on light)
    SAPC = (Math.pow(bgYc, APCA_normBG) - Math.pow(txtYc, APCA_normTXT)) * APCA_scaleBoW;
    return SAPC < APCA_loClip ? 0 : (SAPC - APCA_loBoWoffset) * 100;
  } else {
    // Reverse polarity (light on dark)
    SAPC = (Math.pow(bgYc, APCA_revBG) - Math.pow(txtYc, APCA_revTXT)) * APCA_scaleWoB;
    return SAPC > -APCA_loClip ? 0 : (SAPC + APCA_loWoBoffset) * 100;
  }
}

// --- Palette Audit ---

// Standard contrast pairs to check (from product doc)
interface ContrastPair {
  fgStep: StepIndex;
  bgStep: StepIndex;
  label: string;
  minAPCA: number;
  minWCAG: number;
}

const STANDARD_PAIRS: ContrastPair[] = [
  // Text readability
  { fgStep: 12, bgStep: 1, label: 'High-contrast text on app bg', minAPCA: 90, minWCAG: 7.0 },
  { fgStep: 12, bgStep: 2, label: 'High-contrast text on subtle bg', minAPCA: 75, minWCAG: 4.5 },
  { fgStep: 11, bgStep: 1, label: 'Low-contrast text on app bg', minAPCA: 75, minWCAG: 4.5 },
  { fgStep: 11, bgStep: 2, label: 'Low-contrast text on subtle bg', minAPCA: 60, minWCAG: 3.0 },
  // Component visibility
  { fgStep: 3, bgStep: 1, label: 'UI element bg on app bg', minAPCA: 15, minWCAG: 1.1 },
  // Border visibility
  { fgStep: 6, bgStep: 1, label: 'Subtle border on app bg', minAPCA: 30, minWCAG: 1.5 },
  { fgStep: 7, bgStep: 1, label: 'UI border on app bg', minAPCA: 45, minWCAG: 2.0 },
  { fgStep: 8, bgStep: 1, label: 'Strong border on app bg', minAPCA: 45, minWCAG: 3.0 },
];

function auditRolePalette(
  role: SemanticRole,
  scale: Record<StepIndex, HexColor>
): ContrastResult[] {
  return STANDARD_PAIRS.map(pair => {
    const fg = scale[pair.fgStep];
    const bg = scale[pair.bgStep];
    const apca = Math.abs(checkAPCAContrast(fg, bg));
    const wcag = checkWCAGContrast(fg, bg);

    return {
      role,
      fgStep: pair.fgStep,
      bgStep: pair.bgStep,
      apca: Math.round(apca * 10) / 10,
      wcag: Math.round(wcag * 100) / 100,
      passAPCA: apca >= pair.minAPCA,
      passWCAG_AA: wcag >= pair.minWCAG,
      label: pair.label,
    };
  });
}

export function auditPalette(palette: Palette): AccessibilityReport {
  const results: ContrastResult[] = [];

  for (const role of SEMANTIC_ROLES) {
    const scale = palette[role];
    results.push(...auditRolePalette(role, scale));
  }

  const textPairs = results.filter(r =>
    r.fgStep === 11 || r.fgStep === 12
  );
  const borderPairs = results.filter(r =>
    r.fgStep === 6 || r.fgStep === 7 || r.fgStep === 8
  );

  return {
    results,
    overallPass: results.every(r => r.passAPCA && r.passWCAG_AA),
    textPairsPass: textPairs.every(r => r.passAPCA),
    borderPairsPass: borderPairs.every(r => r.passAPCA),
  };
}
