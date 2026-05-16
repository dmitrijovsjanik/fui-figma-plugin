import { useState, useEffect, useRef } from 'react';
import type { Palette, OklchPalette, AlphaPalette, SemanticRole, StepIndex, ThemeMode } from '../../palette-core';
import { SEMANTIC_ROLES, STEP_INDICES, checkAPCAContrast, softClampY, hexToOklch, computeDefaultStep9to12L } from '../../palette-core';
import type { BrandMode } from '../../palette-core';
import type { StepPreset } from '../preset-types';
import { ContentSwitcher } from '../../components/ContentSwitcher/ContentSwitcher';
import { TextInline } from '../../components/Input/TextInline';
import { IconBox } from '../../components/Icon/IconBox';
import { Tag } from '../../components/Tag/Tag';
import { Button } from '../../components/Button/Button';
import { Dot } from '../../components/Indicator/Dot';
import type { DotColor } from '../../components/Indicator/Dot';
import { ArrowTurnBackwardIcon, FloppyDiskIcon } from '@hugeicons/core-free-icons';

// Parse fraction input: "025" → 0.25, "0" → 0, "0,15" → 0.15, "1" → 1
function parseFractionInput(raw: string): number | null {
  const s = raw.trim();
  if (s === '' || s === ',' || s === '0,') return null;
  const normalized = s.replace(',', '.');
  if (/^0\d{2,}$/.test(normalized)) {
    const parsed = parseFloat('0.' + normalized.slice(1));
    return isNaN(parsed) ? null : parsed;
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

function formatFraction(n: number): string {
  return n.toFixed(3).replace('.', ',');
}

function formatLc(n: number): string {
  return Math.round(n).toString();
}

function parseLcInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const parsed = parseFloat(s);
  return isNaN(parsed) ? null : parsed;
}

export type CurveDisplayMode = 'position' | 'apca';

const _normBG = 0.56, _normTXT = 0.57, _revBG = 0.65, _revTXT = 0.62;
const _scaleBoW = 1.14, _scaleWoB = 1.14;

function rawApcaLc(fgY: number, bgY: number): number {
  const fgYc = softClampY(fgY);
  const bgYc = softClampY(bgY);
  if (bgYc > fgYc) {
    const SAPC = (Math.pow(bgYc, _normBG) - Math.pow(fgYc, _normTXT)) * _scaleBoW;
    return SAPC * 100;
  } else {
    const SAPC = (Math.pow(bgYc, _revBG) - Math.pow(fgYc, _revTXT)) * _scaleWoB;
    return Math.abs(SAPC * 100);
  }
}

function reverseRawApca(targetLc: number, bgY: number, polarity: 'normal' | 'reverse'): number {
  if (targetLc <= 0) return bgY;
  const bgYc = softClampY(bgY);
  if (polarity === 'reverse') {
    const SAPC = targetLc / 100;
    const txtYcPow = Math.pow(bgYc, _revBG) + SAPC / _scaleWoB;
    if (txtYcPow <= 0) return 1.0;
    const txtYc = Math.pow(txtYcPow, 1.0 / _revTXT);
    return Math.min(1.0, Math.max(0, txtYc));
  } else {
    const SAPC = targetLc / 100;
    const txtYcPow = Math.pow(bgYc, _normBG) - SAPC / _scaleBoW;
    if (txtYcPow <= 0) return 0;
    const txtYc = Math.pow(txtYcPow, 1.0 / _normTXT);
    return Math.min(1.0, Math.max(0, txtYc));
  }
}

function positionToApca(position: number, bgL: number, step9L: number, isDark: boolean): number {
  const bgY = bgL * bgL * bgL;
  const s9Y = step9L * step9L * step9L;
  const rangeY = isDark ? (s9Y - bgY) : (bgY - s9Y);
  const offsetY = position * rangeY;
  const stepY = isDark ? bgY + offsetY : bgY - offsetY;
  const fgY = Math.max(0, stepY);
  return rawApcaLc(fgY, bgY);
}

function lightnessToApca(stepL: number, bgL: number): number {
  const fgY = stepL * stepL * stepL;
  const bgY = bgL * bgL * bgL;
  return rawApcaLc(fgY, bgY);
}

function apcaToLightness(targetLc: number, bgL: number, isDark: boolean): number {
  const polarity = isDark ? 'reverse' : 'normal';
  const bgY = bgL * bgL * bgL;
  const fgY = reverseRawApca(targetLc, bgY, polarity);
  return Math.cbrt(fgY);
}

function lightnessToPosition(stepL: number, bgL: number, step9L: number, isDark: boolean): number {
  const bgY = bgL * bgL * bgL;
  const s9Y = step9L * step9L * step9L;
  const rangeY = isDark ? (s9Y - bgY) : (bgY - s9Y);
  if (Math.abs(rangeY) < 1e-10) return 0;
  const stepY = stepL * stepL * stepL;
  const offsetY = isDark ? (stepY - bgY) : (bgY - stepY);
  return offsetY / rangeY;
}

function positionToLightness(position: number, bgL: number, step9L: number, isDark: boolean): number {
  const bgY = bgL * bgL * bgL;
  const s9Y = step9L * step9L * step9L;
  const rangeY = isDark ? (s9Y - bgY) : (bgY - s9Y);
  const offsetY = position * rangeY;
  const stepY = isDark ? bgY + offsetY : bgY - offsetY;
  return Math.cbrt(Math.max(0, stepY));
}

function apcaToPosition(targetLc: number, bgL: number, step9L: number, isDark: boolean): number {
  const polarity = isDark ? 'reverse' : 'normal';
  const bgY = bgL * bgL * bgL;
  const fgY = reverseRawApca(targetLc, bgY, polarity);
  const stepL = Math.cbrt(fgY);
  const s9Y = step9L * step9L * step9L;
  const rangeY = isDark ? (s9Y - bgY) : (bgY - s9Y);
  if (Math.abs(rangeY) < 1e-10) return 0;
  const stepY = stepL * stepL * stepL;
  const offsetY = isDark ? (stepY - bgY) : (bgY - stepY);
  return Math.max(0, Math.min(0.999, offsetY / rangeY));
}

function StepPositionInput({
  value,
  onChange,
  onReset,
  isModified,
  mode,
  apcaValue,
  onChangeApca,
  disabled,
  maxValue = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
  isModified: boolean;
  mode: CurveDisplayMode;
  apcaValue?: number;
  onChangeApca?: (lc: number) => void;
  disabled?: boolean;
  maxValue?: number;
}) {
  const formatValue = mode === 'apca' && apcaValue !== undefined
    ? () => formatLc(apcaValue)
    : () => formatFraction(value);

  const [localValue, setLocalValue] = useState(formatValue());
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatValue());
    }
  }, [value, apcaValue, mode, isFocused]);

  const commit = () => {
    if (mode === 'apca' && onChangeApca) {
      const parsed = parseLcInput(localValue);
      if (parsed !== null) {
        const clamped = Math.max(0, Math.min(120, parsed));
        onChangeApca(clamped);
      }
      setLocalValue(formatValue());
    } else {
      const parsed = parseFractionInput(localValue);
      if (parsed !== null) {
        const clamped = Math.max(0, Math.min(maxValue, parsed));
        onChange(clamped);
        setLocalValue(formatFraction(clamped));
      } else {
        setLocalValue(formatFraction(value));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (mode === 'position') {
      if (v === '0') {
        setLocalValue('0,');
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(2, 2);
        });
        return;
      }
    }
    setLocalValue(v);
  };

  return (
    <TextInline
      ref={inputRef}
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (skipCommitRef.current) {
          skipCommitRef.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          commit();
          inputRef.current?.blur();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (mode === 'apca' && onChangeApca && apcaValue !== undefined) {
            const step = e.shiftKey ? 5 : 1;
            const delta = e.key === 'ArrowUp' ? step : -step;
            const next = Math.max(0, Math.min(120, apcaValue + delta));
            onChangeApca(next);
            setLocalValue(formatLc(next));
          } else {
            const step = e.shiftKey ? 0.1 : 0.01;
            const delta = e.key === 'ArrowUp' ? step : -step;
            const current = parseFractionInput(localValue) ?? value;
            const next = Math.max(0, Math.min(maxValue, current + delta));
            onChange(next);
            setLocalValue(formatFraction(next));
          }
        }
      }}
      onKeyPress={e => {
        if (!/[\d,.]/.test(e.key)) {
          e.preventDefault();
        }
      }}
      onDoubleClick={disabled ? undefined : () => { skipCommitRef.current = true; onReset(); }}
      disabled={disabled}
      padSize="md"
      textSize={14}
      showLabel={false}
      showCaption={false}
      clearable={false}
      trailSlot={isModified ? (
        <IconBox
          icon={ArrowTurnBackwardIcon}
          behavior="highlight"
          onClick={(e) => {
            e.stopPropagation();
            skipCommitRef.current = true;
            onReset();
            setIsFocused(false);
          }}
          title="Reset to default"
        />
      ) : undefined}
      showTrailSlot={isModified}
      title={isModified ? 'Double-click to reset' : undefined}
      style={{ textAlign: 'center' }}
    />
  );
}

interface PaletteMatrixProps {
  palette: Palette;
  oklchPalette: OklchPalette;
  alphaPalette?: AlphaPalette;
  onCopy: (text: string) => void;
  secondaryActive?: boolean;
  displayMode: 'semantic' | 'fill';
  colorFormat: 'alpha' | 'solid';
  stepPositions: Record<number, number>;
  defaultStepPositions: Record<number, number>;
  onStepPositionChange: (step: number, value: number) => void;
  onResetStepPosition: (step: number) => void;
  onResetAllStepPositions: () => void;
  curveDisplayMode: CurveDisplayMode;
  onCurveDisplayModeChange: (mode: CurveDisplayMode) => void;
  backgroundColor: string;
  theme: ThemeMode;
  brandMode: BrandMode;
  defaultStep9L: number;
  presets: StepPreset[];
  activePresetName: string | null;
  onSavePreset: (name: string) => void;
  onLoadPreset: (name: string) => void;
  onDeletePreset: (name: string) => void;
}

const ROLE_LABELS: Record<SemanticRole, string> = {
  brand: 'Brand',
  secondary: 'Secondary',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
  neutral: 'Neutral',
};

const APCA_MIN_LC = 45;

function getAaColor(step: StepIndex, scale: Record<StepIndex, string>): string | null {
  if (step >= 3 && step <= 5) return scale[11];
  if (step === 9 || step === 10) {
    const bg = scale[9];
    const whiteLc = Math.abs(checkAPCAContrast('#ffffff', bg));
    if (whiteLc >= APCA_MIN_LC) return '#ffffff';
    const blackLc = Math.abs(checkAPCAContrast('#000000', bg));
    return blackLc >= APCA_MIN_LC ? '#000000' : scale[1];
  }
  if (step === 11 || step === 12) return scale[step];
  return null;
}

export function PaletteMatrix({ palette, oklchPalette, alphaPalette, onCopy, secondaryActive, displayMode, colorFormat, stepPositions, defaultStepPositions, onStepPositionChange, onResetStepPosition, onResetAllStepPositions, curveDisplayMode, onCurveDisplayModeChange, backgroundColor, theme, brandMode, defaultStep9L, presets, activePresetName, onSavePreset, onLoadPreset, onDeletePreset }: PaletteMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveInputValue, setSaveInputValue] = useState('');
  const saveInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const bgL = hexToOklch(backgroundColor).l;
  const step9L = oklchPalette.neutral[9].l;
  const defaultStep9to12 = computeDefaultStep9to12L(defaultStep9L, isDark);

  const displayRoles = secondaryActive
    ? SEMANTIC_ROLES
    : SEMANTIC_ROLES.filter(r => r !== 'secondary');

  const useAlpha = colorFormat === 'alpha' && !!alphaPalette;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'subgrid',
    gridColumn: '1 / -1',
    gap: 4,
    alignItems: 'center',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(12, 1fr)', gap: 4, marginBottom: 24 }}>
      {/* Color rows */}
      {displayRoles.map(role => (
        <div key={role} style={{ ...gridStyle, marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Dot color={role as DotColor} size={14} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fui-neutral-9)', paddingInline: 4 }}>{ROLE_LABELS[role]}</span>
          </div>

          {STEP_INDICES.map(step => {
            const hex = palette[role][step];
            const alphaColor = useAlpha ? alphaPalette[role][step] : null;
            const color = alphaColor ? alphaColor.css : hex;
            const copyValue = alphaColor ? alphaColor.css : hex;
            const oklch = oklchPalette[role][step];
            const cellId = `${role}-${step}`;
            const isHovered = hoveredCell === cellId;

            const isFill = displayMode === 'fill';
            const aaColor = isFill ? null : getAaColor(step, palette[role]);
            const isBorder = !isFill && step >= 6 && step <= 8;
            const isTextOnly = !isFill && (step === 11 || step === 12);

            return (
              <div
                key={step}
                style={{
                  position: 'relative',
                  height: 40,
                  borderRadius: 'var(--fui-radius-xl)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, z-index 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  transform: isHovered ? 'scale(1.1)' : undefined,
                  zIndex: isHovered ? 10 : undefined,
                  ...(isTextOnly
                    ? { color }
                    : isBorder
                      ? { boxShadow: `inset 0 0 0 2px ${color}` }
                      : { backgroundColor: color }),
                }}
                onMouseEnter={() => setHoveredCell(cellId)}
                onMouseLeave={() => setHoveredCell(null)}
                onClick={() => onCopy(copyValue)}
                title={`${role}-${step}: ${alphaColor ? alphaColor.css : hex}\nL: ${oklch.l.toFixed(3)} C: ${oklch.c.toFixed(3)} H: ${oklch.h.toFixed(1)}`}
              >
                {aaColor && (
                  <span
                    style={{ position: 'relative', fontSize: 14, fontWeight: 600, userSelect: 'none', color: aaColor }}
                  >
                    Aa
                  </span>
                )}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    bottom: -28,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    paddingInline: 6,
                    paddingBlock: 2,
                    borderRadius: 'var(--fui-radius-md)',
                    backgroundColor: 'var(--fui-neutral-12)',
                    color: 'var(--fui-neutral-1)',
                    zIndex: 20,
                  }}>
                    {copyValue}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Fixed alpha scales (theme-invariant) */}
      <FixedAlphaRow label="black α" color="black" />
      <FixedAlphaRow label="white α" color="white" />

      {/* Step position / APCA contrast inputs */}
      <div style={{ ...gridStyle, marginTop: 4 }}>
        <ContentSwitcher
          items={[
            { value: 'position', label: 'Pos' },
            { value: 'apca', label: 'Lc' },
          ]}
          value={curveDisplayMode}
          onChange={v => onCurveDisplayModeChange(v as CurveDisplayMode)}
          padSize="md"
          textSize={14}
        />
        {STEP_INDICES.map(step => {
          if (step <= 8) {
            const isModified = Math.abs((stepPositions[step] ?? 0) - (defaultStepPositions[step] ?? 0)) > 0.0001;
            const apcaVal = positionToApca(stepPositions[step] ?? 0, bgL, step9L, isDark);
            return (
              <StepPositionInput
                key={step}
                value={stepPositions[step] ?? 0}
                onChange={v => onStepPositionChange(step, v)}
                onReset={() => onResetStepPosition(step)}
                isModified={isModified}
                mode={curveDisplayMode}
                apcaValue={apcaVal}
                onChangeApca={lc => {
                  const pos = apcaToPosition(lc, bgL, step9L, isDark);
                  onStepPositionChange(step, pos);
                }}
              />
            );
          }
          // Steps 9-12: offset from algorithmic default L
          const isStep9Locked = step === 9 && brandMode === 'fixed';
          const offset = stepPositions[step] ?? 0;
          const isModified = Math.abs(offset) > 0.0001;
          const defaultL = defaultStep9to12[step as 9 | 10 | 11 | 12];
          const currentL = defaultL + offset;
          const apcaVal = lightnessToApca(currentL, bgL);
          const posValue = lightnessToPosition(currentL, bgL, step9L, isDark);
          return (
            <StepPositionInput
              key={step}
              value={posValue}
              onChange={pos => {
                const newL = positionToLightness(pos, bgL, step9L, isDark);
                onStepPositionChange(step, newL - defaultL);
              }}
              maxValue={2}
              onReset={() => onResetStepPosition(step)}
              isModified={isModified}
              mode={curveDisplayMode}
              apcaValue={apcaVal}
              onChangeApca={lc => {
                const newL = apcaToLightness(lc, bgL, isDark);
                onStepPositionChange(step, newL - defaultL);
              }}
              disabled={isStep9Locked}
            />
          );
        })}
      </div>

      {/* Presets bar */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fui-neutral-9)' }}>Presets</span>
        {presets.map(p => (
          <Tag
            key={p.name}
            variant="filled"
            status={activePresetName === p.name ? 'brand' : 'neutral'}
            padSize="sm"
            textSize={12}
            closable={!p.builtIn}
            onClose={() => onDeletePreset(p.name)}
            onClick={() => onLoadPreset(p.name)}
            style={{ cursor: 'pointer' }}
          >
            {p.name}
          </Tag>
        ))}
        {showSaveInput ? (
          <TextInline
            ref={saveInputRef}
            value={saveInputValue}
            onChange={e => setSaveInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && saveInputValue.trim()) {
                onSavePreset(saveInputValue.trim());
                setShowSaveInput(false);
                setSaveInputValue('');
              }
              if (e.key === 'Escape') {
                setShowSaveInput(false);
                setSaveInputValue('');
              }
            }}
            onBlur={() => {
              if (saveInputValue.trim()) {
                onSavePreset(saveInputValue.trim());
              }
              setShowSaveInput(false);
              setSaveInputValue('');
            }}
            placeholder="Preset name…"
            padSize="sm"
            textSize={12}
            showLabel={false}
            showCaption={false}
            clearable={false}
            style={{ width: 120 }}
            autoFocus
          />
        ) : (
          <Button
            buttonType="tertiary"
            status="neutral"
            padSize="sm"
            textSize={12}
            iconLeft={FloppyDiskIcon}
            onClick={() => {
              setShowSaveInput(true);
              setSaveInputValue('');
              requestAnimationFrame(() => saveInputRef.current?.focus());
            }}
          >
            Save
          </Button>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--fui-neutral-9)', marginTop: 16, gridColumn: '1 / -1' }}>
        Click any swatch to copy {useAlpha ? 'RGBA' : 'HEX'} value. Step 9 = primary color.
      </p>
    </div>
  );
}

// Pure-black / pure-white alpha scale shown under the role matrix. Values are
// fixed (Radix blackA opacities), so this row doesn't react to theme or
// display-mode changes. Hover shows hex/rgba.
const FIXED_ALPHA: Record<number, number> = {
  1: 0.012, 2: 0.024, 3: 0.05, 4: 0.075, 5: 0.10, 6: 0.13,
  7: 0.17, 8: 0.24, 9: 0.43, 10: 0.50, 11: 0.62, 12: 0.92,
};

function FixedAlphaRow({ label, color }: { label: string; color: 'black' | 'white' }) {
  const [hover, setHover] = useState<number | null>(null);
  const rgb = color === 'black' ? '0, 0, 0' : '255, 255, 255';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'subgrid',
      gridColumn: '1 / -1',
      gap: 4,
      alignItems: 'center',
      marginBottom: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: color === 'black' ? '#000' : '#fff',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
        }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fui-neutral-9)', paddingInline: 4 }}>{label}</span>
      </div>
      {([1,2,3,4,5,6,7,8,9,10,11,12] as const).map(step => {
        const a = FIXED_ALPHA[step];
        const rgba = `rgba(${rgb}, ${a})`;
        const isHovered = hover === step;
        return (
          <div
            key={step}
            style={{
              position: 'relative',
              height: 28,
              borderRadius: 'var(--fui-radius-xl)',
              backgroundColor: rgba,
              cursor: 'default',
              transition: 'transform 0.15s, z-index 0.15s',
              transform: isHovered ? 'scale(1.1)' : undefined,
              zIndex: isHovered ? 10 : undefined,
              boxSizing: 'border-box',
              // Subtle outline so very-light white-α steps stay visible.
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={() => setHover(step)}
            onMouseLeave={() => setHover(null)}
            title={`${color}.a${step}: ${rgba}`}
          >
            {isHovered && (
              <div style={{
                position: 'absolute',
                bottom: -28,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 10,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                paddingInline: 6,
                paddingBlock: 2,
                borderRadius: 'var(--fui-radius-md)',
                backgroundColor: 'var(--fui-neutral-12)',
                color: 'var(--fui-neutral-1)',
                zIndex: 20,
              }}>
                {rgba}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
