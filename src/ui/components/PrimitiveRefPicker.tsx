// Two-dropdown picker (scale + step) for a single PrimitiveRef value.
// Both dropdowns render a color swatch in the trigger AND alongside every
// option in the menu, so the user can pick visually.
//
// Special handling:
//  - In role-slot mode (`mode === 'slot'`): the scale dropdown is locked to
//    '{role}' and only the step/alpha is editable. The swatch shows the brand
//    role for preview (since {role} hasn't been substituted yet).
//  - In standalone mode (`mode === 'standalone'`): full freedom over scale,
//    plus the special 'white-fixed' option (auto-disables step/alpha) and
//    'black' scale (alpha-only).

import { useRef, useState, useEffect, useCallback } from 'react';
import { Dropdown } from '../../components/Dropdown/Dropdown';
import { MenuItem } from '../../components/Menu/MenuItem';
import { Button } from '../../components/Button/Button';
import { ChevronDownIcon } from '../../components/Button/ChevronDownIcon';
import { TextSizeProvider } from '../../components/Icon/IconBox';
import { PAD_CLASS, TEXT_CLASS, MENU_ITEM_HEIGHT } from '../../tokens/size';
import selectStyles from '../../components/Input/Select.module.css';
import {
  PRIMITIVE_SCALE_NAMES,
  type GenerationResult,
  type SemanticRole,
} from '../../palette-core';

type Mode = 'standalone' | 'slot';

export interface PrimitiveRefPickerProps {
  mode: Mode;
  value: string;                  // ref string like 'gray.9' / 'gray.a3' / '{role}.9' / 'white-fixed' / 'black.a8'
  onChange: (next: string) => void;
  includeSecondary?: boolean;     // hide 'secondary' scale option if false
  previewRole?: SemanticRole;     // used to render swatch for {role}-based refs
  previewResult?: GenerationResult | null;
  // The OPPOSITE theme's palette — used to colour the swatch when invert is on.
  invertedPreviewResult?: GenerationResult | null;
  // Theme-invert toggle: when true, this ref is resolved against the OPPOSITE
  // primitive theme. Only meaningful for themed scales (not black/white/white-fixed).
  invert?: boolean;
  onInvertChange?: (next: boolean) => void;
}

interface ParsedRef {
  scale: string;
  step: number;
  isAlpha: boolean;
}

function parseRefValue(ref: string): ParsedRef {
  if (ref === 'white-fixed') return { scale: 'white-fixed', step: 0, isAlpha: false };
  const [scale, stepRaw] = ref.split('.');
  const isAlpha = stepRaw?.startsWith('a') ?? false;
  const step = Number(isAlpha ? stepRaw.slice(1) : stepRaw);
  return { scale, step: isNaN(step) ? 1 : step, isAlpha };
}

function buildRef(parsed: ParsedRef): string {
  if (parsed.scale === 'white-fixed') return 'white-fixed';
  const prefix = parsed.isAlpha ? 'a' : '';
  return `${parsed.scale}.${prefix}${parsed.step}`;
}

const SCALE_TO_ROLE: Record<string, SemanticRole> = {
  gray: 'neutral', accent: 'brand', secondary: 'secondary',
  green: 'success', amber: 'warning', red: 'danger', blue: 'info',
};

const BLACK_ALPHA: Record<number, number> = {
  1: 0.012, 2: 0.024, 3: 0.05, 4: 0.075, 5: 0.10, 6: 0.13,
  7: 0.17, 8: 0.24, 9: 0.43, 10: 0.50, 11: 0.62, 12: 0.92,
};

// Resolves a swatch color for an arbitrary ref using the live preview palette.
function resolveSwatchColor(
  scale: string,
  step: number,
  isAlpha: boolean,
  previewRole: SemanticRole | undefined,
  previewResult: GenerationResult | null | undefined,
): string {
  if (scale === 'white-fixed') return '#ffffff';
  if (scale === 'black') return `rgba(0, 0, 0, ${BLACK_ALPHA[step] ?? 0})`;
  if (scale === 'white') return `rgba(255, 255, 255, ${BLACK_ALPHA[step] ?? 0})`;
  if (!previewResult) return 'transparent';

  const role: SemanticRole | undefined = scale === '{role}'
    ? (previewRole ?? 'brand')
    : SCALE_TO_ROLE[scale];
  if (!role) return 'transparent';

  const stepIdx = (step === 0 ? 1 : step) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  if (isAlpha && previewResult.alphaPalette) {
    return previewResult.alphaPalette[role]?.[stepIdx]?.css ?? 'transparent';
  }
  return previewResult.palette[role]?.[stepIdx] ?? 'transparent';
}

interface ScaleOption {
  value: string;
  label: string;
  // When set, the dropdown row shows a small swatch using the *current* step/alpha
  // applied to this scale. For 'white-fixed' / 'black' / 'white' the swatch is fixed.
  kind: 'normal' | 'black' | 'white' | 'white-fixed';
}

export function PrimitiveRefPicker(props: PrimitiveRefPickerProps) {
  const { mode, value, onChange, includeSecondary = true, previewRole, previewResult, invertedPreviewResult, invert = false, onInvertChange } = props;
  // When inverted, look up colors in the opposite-theme palette so the swatch
  // shows what Figma will actually emit at sync time.
  const activePreview = invert ? (invertedPreviewResult ?? previewResult) : previewResult;
  const parsed = parseRefValue(value);
  const isWhiteFixed = parsed.scale === 'white-fixed';
  const isBlack = parsed.scale === 'black';
  const isWhite = parsed.scale === 'white';
  const isFixedAlpha = isBlack || isWhite;

  const scaleOptions: ScaleOption[] = (() => {
    if (mode === 'slot') {
      return [{ value: '{role}', label: '{role}', kind: 'normal' as const }];
    }
    const opts: ScaleOption[] = PRIMITIVE_SCALE_NAMES
      .filter(s => includeSecondary || s !== 'secondary')
      .map(s => ({ value: s, label: s, kind: 'normal' as const }));
    opts.push({ value: 'black', label: 'black α', kind: 'black' as const });
    opts.push({ value: 'white', label: 'white α', kind: 'white' as const });
    opts.push({ value: 'white-fixed', label: 'white-fixed', kind: 'white-fixed' as const });
    return opts;
  })();

  // Step options
  const stepValues: number[] = (() => {
    if (isWhiteFixed) return [0];
    if (isFixedAlpha) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (parsed.isAlpha) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  })();

  const handleScale = (next: string) => {
    if (next === 'white-fixed') {
      onChange('white-fixed');
      return;
    }
    if (next === 'black' || next === 'white') {
      // Fixed alpha scales — alpha-only; pick step (or default to 8).
      const step = parsed.step === 0 ? 8 : parsed.step;
      onChange(`${next}.a${step}`);
      return;
    }
    const step = parsed.step === 0 && parsed.isAlpha ? 1 : parsed.step;
    onChange(buildRef({ scale: next, step: step || 1, isAlpha: parsed.isAlpha }));
  };

  const handleStep = (stepNum: number) => {
    if (isWhiteFixed) return;
    onChange(buildRef({ scale: parsed.scale, step: stepNum, isAlpha: parsed.isAlpha }));
  };

  const handleAlphaToggle = () => {
    if (isWhiteFixed || isFixedAlpha) return;
    const isAlpha = !parsed.isAlpha;
    const step = isAlpha && parsed.step === 0 ? 1 : parsed.step;
    onChange(buildRef({ scale: parsed.scale, step, isAlpha }));
  };

  const triggerSwatch = resolveSwatchColor(parsed.scale, parsed.step, parsed.isAlpha, previewRole, activePreview);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {/* Scale picker — no swatch in trigger; the step picker already shows the resolved color. */}
      <SwatchPicker
        widthPx={110}
        currentLabel={scaleOptions.find(o => o.value === parsed.scale)?.label ?? parsed.scale}
        disabled={mode === 'slot'}
        renderOptions={() => scaleOptions.map(opt => {
          const swatch = opt.kind === 'white-fixed'
            ? '#ffffff'
            : opt.kind === 'black'
              ? `rgba(0,0,0,${BLACK_ALPHA[parsed.step] ?? 0.24})`
              : opt.kind === 'white'
                ? `rgba(255,255,255,${BLACK_ALPHA[parsed.step] ?? 0.24})`
                : resolveSwatchColor(opt.value, parsed.step || 9, parsed.isAlpha, previewRole, activePreview);
          return (
            <PickerOption
              key={opt.value}
              selected={opt.value === parsed.scale}
              swatch={swatch}
              label={opt.label}
              onSelect={() => handleScale(opt.value)}
            />
          );
        })}
      />

      {/* Step picker */}
      <SwatchPicker
        widthPx={68}
        currentLabel={String(parsed.step)}
        currentSwatch={triggerSwatch}
        disabled={isWhiteFixed}
        renderOptions={() => stepValues.map(s => {
          const swatch = resolveSwatchColor(parsed.scale, s, parsed.isAlpha, previewRole, activePreview);
          return (
            <PickerOption
              key={s}
              selected={s === parsed.step}
              swatch={swatch}
              label={String(s)}
              onSelect={() => handleStep(s)}
            />
          );
        })}
      />

      {/* Alpha toggle */}
      <Button
        kind="text"
        buttonType="tertiary"
        status="neutral"
        padSize="sm"
        textSize={12}
        toggleable
        pressed={parsed.isAlpha}
        onClick={handleAlphaToggle}
        disabled={isWhiteFixed || isFixedAlpha}
        title={parsed.isAlpha ? 'Alpha scale — click to use solid' : 'Solid scale — click to use alpha'}
      >
        α
      </Button>

      {/* Theme-invert toggle. Only useful on themed scales; disabled for
          black/white α and white-fixed where the primitive is theme-invariant. */}
      <Button
        kind="text"
        buttonType="tertiary"
        status="neutral"
        padSize="sm"
        textSize={12}
        toggleable
        pressed={invert}
        onClick={() => onInvertChange?.(!invert)}
        disabled={isWhiteFixed || isFixedAlpha || !onInvertChange}
        title={invert ? 'Inverted: this ref resolves against the opposite primitive theme' : 'Use the opposite primitive theme (e.g. dark gray.9 inside a Light mode token)'}
      >
        inv
      </Button>
    </div>
  );
}

// ---- Internal: lightweight trigger + dropdown with swatch rendering ----

function SwatchPicker(props: {
  widthPx: number;
  currentLabel: string;
  // Optional — when omitted, the trigger renders without a swatch tile. Used
  // for the scale dropdown where the step picker already shows the color.
  currentSwatch?: string;
  disabled?: boolean;
  renderOptions: () => React.ReactNode;
}) {
  const { widthPx, currentLabel, currentSwatch, disabled, renderOptions } = props;
  const triggerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click handled by Dropdown's outside-detection.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Reuse the Select component's field classes so the trigger inherits the
  // same background/border/hover/focus treatment as every other Select in
  // the app. Rendered as a <div role="combobox"> to match Select exactly —
  // a native <button> applies its own browser baseline (padding, font)
  // which fights with the .field class.
  const sizeCls = `${PAD_CLASS.sm} ${TEXT_CLASS[12]}`;
  const fieldCls = [
    selectStyles.field,
    sizeCls,
    open && selectStyles.focused,
    disabled && selectStyles.disabled,
  ].filter(Boolean).join(' ');

  return (
    <TextSizeProvider size={12}>
      <div
        ref={anchorRef}
        className={[selectStyles.wrapper, sizeCls].join(' ')}
        style={{ minWidth: widthPx }}
      >
        <div
          ref={triggerRef}
          className={fieldCls}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-disabled={disabled || undefined}
          onClick={() => !disabled && setOpen(o => !o)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(o => !o);
            }
          }}
          // Match TextInline's translucent neutral fill so pickers sit on
          // any container background (GroupPanel, surface-2, …) without
          // looking like a solid plate.
          style={{ backgroundColor: open ? 'var(--fui-neutral-0)' : 'var(--fui-neutral-a-2)' }}
        >
          <div className={selectStyles.bodyRow}>
            {currentSwatch !== undefined && (
              <div className={selectStyles.slot}>
                <SwatchTile color={currentSwatch} size={14} />
              </div>
            )}
            <span className={selectStyles.value}>{currentLabel}</span>
            <ChevronDownIcon className={[selectStyles.chevron, open && selectStyles.chevronOpen].filter(Boolean).join(' ')} />
          </div>
        </div>
        <Dropdown
          anchorRef={anchorRef}
          open={open}
          onClose={close}
          itemHeight={MENU_ITEM_HEIGHT.sm}
          maxVisible={8}
          matchWidth={8}
          offsetX={-4}
        >
          {renderOptions()}
        </Dropdown>
      </div>
    </TextSizeProvider>
  );
}

function PickerOption(props: {
  selected: boolean;
  swatch: string;
  label: string;
  onSelect: () => void;
}) {
  const { selected, swatch, label, onSelect } = props;
  return (
    <MenuItem
      padSize="sm"
      textSize={12}
      selected={selected}
      leadSlot={<SwatchTile color={swatch} size={14} />}
      onMouseDown={(e) => { e.preventDefault(); onSelect(); }}
    >
      {label}
    </MenuItem>
  );
}

// Round color swatch — used in trigger, dropdown rows and inline previews.
function SwatchTile({ color, size }: { color: string; size: number }) {
  const isTransparent = color === 'transparent';
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: isTransparent
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 6px 6px'
          : color,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
      }}
    />
  );
}
