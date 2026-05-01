/** Padding / density axis */
export type PadSize = 'sm' | 'md' | 'lg';

/** Text / typography axis — numeric font-size from tokens */
export type TextSize = 12 | 14 | 16 | 18 | 20 | 22 | 24;

/** CSS class names for padding axis */
export const PAD_CLASS: Record<PadSize, string> = {
  sm: 'fui-pad-sm',
  md: 'fui-pad-md',
  lg: 'fui-pad-lg',
};

/** CSS class names for text axis */
export const TEXT_CLASS: Record<TextSize, string> = {
  12: 'fui-text-12',
  14: 'fui-text-14',
  16: 'fui-text-16',
  18: 'fui-text-18',
  20: 'fui-text-20',
  22: 'fui-text-22',
  24: 'fui-text-24',
};

/** Compact line-height per text size (UI context). */
export const COMPACT_LH: Record<TextSize, number> = {
  12: 16, 14: 20, 16: 22, 18: 24, 20: 28, 22: 30, 24: 32,
};

/** The drawn icon size (actual SVG) = fontSize + 2. */
export const ICON_SIZE: Record<TextSize, number> = {
  12: 14, 14: 16, 16: 18, 18: 20, 20: 22, 22: 24, 24: 26,
};

/** The container that wraps the icon — matches line-height so icons align with text. */
export const ICON_BOX: Record<TextSize, number> = {
  12: 16, 14: 20, 16: 22, 18: 24, 20: 28, 22: 30, 24: 32,
};

/** Icon stroke width in absolute pixels. CSS `non-scaling-stroke` keeps it constant at any size. */
export const ICON_STROKE_WIDTH = 1.5;

/** Compensation to round line-height up to nearest 4px grid. */
export function textCompensation(size: TextSize): number {
  const lh = COMPACT_LH[size];
  const rem = lh % 4;
  return rem === 0 ? 0 : 4 - rem;
}

/** Menu item height for a padSize + textSize combo: pad-v×2 + lineHeight + compensation. */
export function menuItemHeight(padSize: PadSize, textSize: TextSize): number {
  const padV = { sm: 4, md: 8, lg: 12 }[padSize];
  return padV * 2 + COMPACT_LH[textSize] + textCompensation(textSize);
}

/** Shorthand: menu item height assuming textSize=14 (most common). */
export const MENU_ITEM_HEIGHT: Record<PadSize, number> = {
  sm: menuItemHeight('sm', 14),
  md: menuItemHeight('md', 14),
  lg: menuItemHeight('lg', 14),
};
