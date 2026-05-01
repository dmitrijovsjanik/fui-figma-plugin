import {
  type ReactNode,
  forwardRef,
  useState,
  useRef,
  useCallback,
  useId,
  useMemo,
  useEffect,
} from 'react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './Slider.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type SliderMode = 'field' | 'compact' | 'input';

export interface SliderProps {
  padSize?: PadSize;
  textSize?: TextSize;
  labelTextSize?: TextSize;
  captionTextSize?: TextSize;
  variant?: 'default' | 'inner';
  showLabel?: boolean;
  label?: string;
  labelAction?: ReactNode;
  showCaption?: boolean;
  caption?: string;
  errorMessage?: string;
  disabled?: boolean;
  wrapperClassName?: string;
  className?: string;

  mode?: SliderMode;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;

  range?: boolean;
  rangeValue?: [number, number];
  defaultRangeValue?: [number, number];
  onRangeChange?: (value: [number, number]) => void;
  onRangeChangeEnd?: (value: [number, number]) => void;

  showValue?: boolean;
  formatValue?: (v: number) => string;
  leadSlot?: ReactNode;
  trailSlot?: ReactNode;
  showLeadSlot?: boolean;
  showTrailSlot?: boolean;

  /** Number of evenly-spaced tick segments, or an array of specific tick values */
  ticks?: number | number[];
  /** Minor (smaller) ticks — number of segments or array of values */
  minorTicks?: number | number[];
  /** When true, dragging snaps strictly to tick positions (step is ignored) */
  snapToTicks?: boolean;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function snap(val: number, min: number, max: number, step: number) {
  const snapped = Math.round((val - min) / step) * step + min;
  // Fix floating point precision
  const decimals = (step.toString().split('.')[1] || '').length;
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

function pctOf(val: number, min: number, max: number) {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 100;
}

function positionToValue(
  clientX: number,
  trackRect: DOMRect,
  min: number,
  max: number,
  step: number,
) {
  const ratio = clamp((clientX - trackRect.left) / trackRect.width, 0, 1);
  return snap(min + ratio * (max - min), min, max, step);
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      padSize = 'md',
      textSize = 14,
      labelTextSize,
      captionTextSize,
      variant = 'default',
      showLabel = true,
      label,
      labelAction,
      showCaption = true,
      caption,
      errorMessage,
      disabled,
      wrapperClassName,
      className,

      mode = 'field',
      min = 0,
      max = 100,
      step = 1,
      value,
      defaultValue,
      onChange,
      onChangeEnd,

      range = false,
      rangeValue,
      defaultRangeValue,
      onRangeChange,
      onRangeChangeEnd,

      showValue = false,
      formatValue,
      leadSlot,
      trailSlot,
      showLeadSlot = true,
      showTrailSlot = true,

      ticks,
      minorTicks,
      snapToTicks = false,
    },
    ref,
  ) => {
    const captionId = useId();

    // --- Single value state ---
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue ?? min);
    const currentValue = isControlled ? value : internalValue;

    const updateValue = useCallback(
      (v: number) => {
        if (!isControlled) setInternalValue(v);
        onChange?.(v);
      },
      [isControlled, onChange],
    );

    // --- Range state ---
    const isRangeControlled = rangeValue !== undefined;
    const [internalRange, setInternalRange] = useState<[number, number]>(
      defaultRangeValue ?? [min, max],
    );
    const currentRange: [number, number] = isRangeControlled
      ? rangeValue
      : internalRange;

    const updateRange = useCallback(
      (v: [number, number]) => {
        if (!isRangeControlled) setInternalRange(v);
        onRangeChange?.(v);
      },
      [isRangeControlled, onRangeChange],
    );

    // --- Interaction state ---
    const [focused, setFocused] = useState(false);
    const dragging = useRef<null | 'single' | 'start' | 'end'>(null);
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeRangeThumb = useRef<'start' | 'end'>('end');

    // --- Input mode: text input change handler ---
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseFloat(e.target.value);
        if (!isNaN(raw)) {
          const clamped = clamp(raw, min, max);
          updateValue(clamped);
        }
      },
      [min, max, updateValue],
    );

    const handleInputBlur = useCallback(() => {
      // Snap to step on blur
      const snapped = snap(currentValue, min, max, step);
      if (snapped !== currentValue) updateValue(snapped);
      setFocused(false);
    }, [currentValue, min, max, step, updateValue]);

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
      },
      [],
    );

    const hasError = !!errorMessage;
    const isInput = mode === 'input';
    const isInner = variant === 'inner' && (mode === 'field' || isInput);
    const isCompact = mode === 'compact';

    // --- Tick hint warm-up: first hint delayed, subsequent instant ---
    const [hintWarmed, setHintWarmed] = useState(false);
    const hintTimers = useRef<{ warm: ReturnType<typeof setTimeout> | null; cool: ReturnType<typeof setTimeout> | null }>({ warm: null, cool: null });

    const handleTickMouseEnter = useCallback(() => {
      // Cancel cool-down
      if (hintTimers.current.cool) { clearTimeout(hintTimers.current.cool); hintTimers.current.cool = null; }
      // Start warm-up if not already warmed
      if (!hintTimers.current.warm) {
        hintTimers.current.warm = setTimeout(() => {
          hintTimers.current.warm = null;
          setHintWarmed(true);
        }, 400);
      }
    }, []);

    const handleTickMouseLeave = useCallback(() => {
      // Cancel warm-up
      if (hintTimers.current.warm) { clearTimeout(hintTimers.current.warm); hintTimers.current.warm = null; }
      // Start cool-down
      if (hintTimers.current.cool) clearTimeout(hintTimers.current.cool);
      hintTimers.current.cool = setTimeout(() => {
        hintTimers.current.cool = null;
        setHintWarmed(false);
      }, 300);
    }, []);

    useEffect(() => {
      return () => {
        if (hintTimers.current.warm) clearTimeout(hintTimers.current.warm);
        if (hintTimers.current.cool) clearTimeout(hintTimers.current.cool);
      };
    }, []);

    // --- Tick values ---
    const tickValues = useMemo(() => {
      if (ticks == null) return null;
      if (Array.isArray(ticks)) return ticks;
      if (ticks < 2) return null;
      const precision = Math.max(
        (String(min).split('.')[1] || '').length,
        (String(max).split('.')[1] || '').length,
        (String(step).split('.')[1] || '').length,
      );
      const vals: number[] = [];
      for (let i = 0; i <= ticks; i++) {
        vals.push(Number((min + (i / ticks) * (max - min)).toFixed(precision)));
      }
      return vals;
    }, [ticks, min, max, step]);

    const minorTickValues = useMemo(() => {
      if (minorTicks == null) return null;
      if (Array.isArray(minorTicks)) return minorTicks;
      if (minorTicks < 2) return null;
      const precision = Math.max(
        (String(min).split('.')[1] || '').length,
        (String(max).split('.')[1] || '').length,
        (String(step).split('.')[1] || '').length,
      );
      const vals: number[] = [];
      for (let i = 0; i <= minorTicks; i++) {
        vals.push(Number((min + (i / minorTicks) * (max - min)).toFixed(precision)));
      }
      return vals;
    }, [minorTicks, min, max, step]);

    // Set of major tick values for filtering minor ticks that overlap
    const majorTickSet = useMemo(() => {
      if (!tickValues) return new Set<number>();
      return new Set(tickValues);
    }, [tickValues]);

    // Resolve a clientX position to a value, respecting step and snapToTicks
    const resolveValue = useCallback(
      (clientX: number, trackRect: DOMRect) => {
        const ratio = clamp((clientX - trackRect.left) / trackRect.width, 0, 1);
        const raw = min + ratio * (max - min);
        if (snapToTicks && tickValues && tickValues.length >= 2) {
          // Snap to nearest tick
          let closest = tickValues[0];
          let best = Math.abs(raw - closest);
          for (let i = 1; i < tickValues.length; i++) {
            const dist = Math.abs(raw - tickValues[i]);
            if (dist < best) { best = dist; closest = tickValues[i]; }
          }
          return closest;
        }
        return snap(raw, min, max, step);
      },
      [min, max, step, snapToTicks, tickValues],
    );

    // --- Pointer handlers ---
    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (disabled) return;
        const track = trackRef.current;
        if (!track) return;

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setIsDragging(true);
        // Focus the track element for keyboard support
        trackRef.current?.focus();

        const rect = track.getBoundingClientRect();
        const val = resolveValue(e.clientX, rect);

        if (range) {
          // Determine which thumb is closer
          const distStart = Math.abs(val - currentRange[0]);
          const distEnd = Math.abs(val - currentRange[1]);
          const thumb = distStart <= distEnd ? 'start' : 'end';
          dragging.current = thumb;
          activeRangeThumb.current = thumb;

          const newRange: [number, number] =
            thumb === 'start'
              ? [clamp(val, min, currentRange[1]), currentRange[1]]
              : [currentRange[0], clamp(val, currentRange[0], max)];
          updateRange(newRange);
        } else {
          dragging.current = 'single';
          updateValue(val);
        }
      },
      [disabled, min, max, range, currentRange, updateRange, updateValue, resolveValue],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!dragging.current) return;
        const track = trackRef.current;
        if (!track) return;

        const rect = track.getBoundingClientRect();
        const val = resolveValue(e.clientX, rect);

        if (range) {
          if (dragging.current === 'start') {
            updateRange([clamp(val, min, currentRange[1]), currentRange[1]]);
          } else {
            updateRange([currentRange[0], clamp(val, currentRange[0], max)]);
          }
        } else {
          updateValue(val);
        }
      },
      [min, max, range, currentRange, updateRange, updateValue, resolveValue],
    );

    const handlePointerUp = useCallback(
      (_e: React.PointerEvent) => {
        if (!dragging.current) return;
        dragging.current = null;
        setIsDragging(false);

        if (range) {
          onRangeChangeEnd?.(currentRange);
        } else {
          onChangeEnd?.(currentValue);
        }
      },
      [range, currentRange, currentValue, onRangeChangeEnd, onChangeEnd],
    );

    // --- Keyboard handler ---
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;
        let delta = 0;
        const keyStep = snapToTicks && tickValues && tickValues.length >= 2
          ? (max - min) / (tickValues.length - 1)
          : step;
        // Helper to snap keyboard value if snapToTicks is on
        const snapKey = (v: number) => {
          if (snapToTicks && tickValues && tickValues.length >= 2) {
            let closest = tickValues[0];
            let best = Math.abs(v - closest);
            for (let i = 1; i < tickValues.length; i++) {
              const dist = Math.abs(v - tickValues[i]);
              if (dist < best) { best = dist; closest = tickValues[i]; }
            }
            return closest;
          }
          return snap(v, min, max, step);
        };
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            delta = keyStep;
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            delta = -keyStep;
            break;
          case 'PageUp':
            delta = keyStep * 10;
            break;
          case 'PageDown':
            delta = -keyStep * 10;
            break;
          case 'Home':
            if (range) {
              const thumb = activeRangeThumb.current;
              const newRange: [number, number] =
                thumb === 'start'
                  ? [min, currentRange[1]]
                  : [currentRange[0], currentRange[0]];
              updateRange(newRange);
              onRangeChangeEnd?.(newRange);
            } else {
              updateValue(min);
              onChangeEnd?.(min);
            }
            e.preventDefault();
            return;
          case 'End':
            if (range) {
              const thumb = activeRangeThumb.current;
              const newRange: [number, number] =
                thumb === 'start'
                  ? [currentRange[1], currentRange[1]]
                  : [currentRange[0], max];
              updateRange(newRange);
              onRangeChangeEnd?.(newRange);
            } else {
              updateValue(max);
              onChangeEnd?.(max);
            }
            e.preventDefault();
            return;
          case 'Enter':
          case 'Escape':
            (e.target as HTMLElement).blur();
            e.preventDefault();
            return;
          default:
            return;
        }

        e.preventDefault();
        if (range) {
          const thumb = activeRangeThumb.current;
          const newRange: [number, number] =
            thumb === 'start'
              ? [snapKey(clamp(currentRange[0] + delta, min, currentRange[1])), currentRange[1]]
              : [currentRange[0], snapKey(clamp(currentRange[1] + delta, currentRange[0], max))];
          updateRange(newRange);
          onRangeChangeEnd?.(newRange);
        } else {
          const newVal = snapKey(clamp(currentValue + delta, min, max));
          updateValue(newVal);
          onChangeEnd?.(newVal);
        }
      },
      [disabled, step, min, max, range, currentRange, currentValue, updateRange, updateValue, onRangeChangeEnd, onChangeEnd, snapToTicks, tickValues],
    );

    // --- Format ---
    const fmt = (v: number) => formatValue?.(v) ?? String(v);

    // --- CSS ---
    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    // --- Shared pieces ---
    const labelBlock = showLabel && label && (
      <div className={[s.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
        <span className={s.label}>{label}</span>
        {labelAction}
      </div>
    );

    const captionZoneCls = captionTextSize ? TEXT_CLASS[captionTextSize] : undefined;
    const hasErrorMessage = !!errorMessage;

    const captionContent = (
      <>
        {hasErrorMessage && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')} id={captionId}>
            <span className={s.errorMessage}>{errorMessage}</span>
          </div>
        )}
        {!hasErrorMessage && showCaption && caption && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')} id={captionId}>
            <span className={s.caption}>{caption}</span>
          </div>
        )}
      </>
    );

    const hasCaptionContent = hasErrorMessage || (showCaption && !!caption);

    // --- ARIA for single slider ---
    const ariaProps = !range
      ? {
          role: 'slider' as const,
          'aria-valuemin': min,
          'aria-valuemax': max,
          'aria-valuenow': currentValue,
          'aria-valuetext': fmt(currentValue),
          'aria-label': label,
          'aria-disabled': disabled || undefined,
          'aria-invalid': hasError || undefined,
          'aria-describedby': hasCaptionContent ? captionId : undefined,
          tabIndex: disabled ? -1 : 0,
        }
      : {
          role: 'group' as const,
          'aria-label': label,
        };

    // --- Percent calculations ---
    const singlePct = pctOf(currentValue, min, max);
    const rangePctStart = pctOf(currentRange[0], min, max);
    const rangePctEnd = pctOf(currentRange[1], min, max);

    // --- Tick marks ---
    const handleTickClick = useCallback(
      (tickVal: number) => {
        if (disabled) return;
        if (range) {
          const distStart = Math.abs(tickVal - currentRange[0]);
          const distEnd = Math.abs(tickVal - currentRange[1]);
          if (distStart <= distEnd) {
            const newRange: [number, number] = [clamp(tickVal, min, currentRange[1]), currentRange[1]];
            updateRange(newRange);
            onRangeChangeEnd?.(newRange);
          } else {
            const newRange: [number, number] = [currentRange[0], clamp(tickVal, currentRange[0], max)];
            updateRange(newRange);
            onRangeChangeEnd?.(newRange);
          }
        } else {
          updateValue(tickVal);
          onChangeEnd?.(tickVal);
        }
      },
      [disabled, range, currentRange, min, max, updateRange, updateValue, onRangeChangeEnd, onChangeEnd],
    );

    // Tick pointerdown: set exact value + start drag
    const handleTickPointerDown = useCallback(
      (tv: number, e: React.PointerEvent) => {
        e.stopPropagation();
        if (disabled) return;
        handleTickClick(tv);
        // Start drag so user can click tick and immediately drag
        setIsDragging(true);
        trackRef.current?.focus();
        dragging.current = range ? (
          Math.abs(tv - currentRange[0]) <= Math.abs(tv - currentRange[1]) ? 'start' : 'end'
        ) : 'single';
        // Capture pointer on the track/field parent for continued drag
        const captureEl = isCompact ? trackRef.current : (e.currentTarget as HTMLElement).closest(`.${s.field}`) as HTMLElement;
        captureEl?.setPointerCapture(e.pointerId);
      },
      [disabled, handleTickClick, range, currentRange, isCompact],
    );

    const isTickFilled = (tv: number) => {
      if (range) return tv >= currentRange[0] && tv <= currentRange[1];
      return tv <= currentValue;
    };

    const tickCls = (tv: number, minor?: boolean) =>
      [s.tick, minor && s.tickMinor, isTickFilled(tv) && s.tickFilled, hintWarmed && s.hintReady]
        .filter(Boolean)
        .join(' ');

    const tickMarks = (tickValues || minorTickValues) && (
      <>
        {minorTickValues?.map((tv) => {
          if (tv === min || tv === max) return null;
          if (majorTickSet.has(tv)) return null;
          const pct = pctOf(tv, min, max);
          return (
            <div
              key={`m${tv}`}
              className={tickCls(tv, true)}
              style={{ left: `${pct}%` }}
              data-hint={fmt(tv)}
              onPointerDown={(e) => handleTickPointerDown(tv, e)}
              onMouseEnter={handleTickMouseEnter}
              onMouseLeave={handleTickMouseLeave}
            />
          );
        })}
        {tickValues?.map((tv) => {
          if (tv === min || tv === max) return null;
          const pct = pctOf(tv, min, max);
          return (
            <div
              key={tv}
              className={tickCls(tv)}
              style={{ left: `${pct}%` }}
              data-hint={fmt(tv)}
              onPointerDown={(e) => handleTickPointerDown(tv, e)}
              onMouseEnter={handleTickMouseEnter}
              onMouseLeave={handleTickMouseLeave}
            />
          );
        })}
      </>
    );

    // --- Track content ---
    const trackContent = range ? (
      <>
        {isCompact ? (
          <>
            {tickMarks}
            <div
              className={s.compactFill}
              style={{ left: `${rangePctStart}%`, width: `${rangePctEnd - rangePctStart}%` }}
            />
            <div
              className={[s.compactThumb, isDragging && dragging.current === 'start' && s.active].filter(Boolean).join(' ')}
              style={{ left: `${rangePctStart}%` }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-valuemin={min}
              aria-valuemax={currentRange[1]}
              aria-valuenow={currentRange[0]}
              aria-valuetext={fmt(currentRange[0])}
              aria-label={label ? `${label} start` : 'Range start'}
              aria-disabled={disabled || undefined}
              aria-invalid={hasError || undefined}
              onFocus={() => { activeRangeThumb.current = 'start'; setFocused(true); }}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
            />
            <div
              className={[s.compactThumb, isDragging && dragging.current === 'end' && s.active].filter(Boolean).join(' ')}
              style={{ left: `${rangePctEnd}%` }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-valuemin={currentRange[0]}
              aria-valuemax={max}
              aria-valuenow={currentRange[1]}
              aria-valuetext={fmt(currentRange[1])}
              aria-label={label ? `${label} end` : 'Range end'}
              aria-disabled={disabled || undefined}
              aria-invalid={hasError || undefined}
              onFocus={() => { activeRangeThumb.current = 'end'; setFocused(true); }}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
            />
          </>
        ) : (
          <>
            <div className={s.fillClip}>
              <div
                className={s.fill}
                style={{ left: `${rangePctStart}%`, width: `${rangePctEnd - rangePctStart}%` }}
              />
            </div>
            <div className={s.tickLayer}>{tickMarks}</div>
            <div className={[s.indicator, isDragging && dragging.current === 'start' && s.active].filter(Boolean).join(' ')} style={{ left: `${rangePctStart}%` }} />
            <div className={[s.indicator, isDragging && dragging.current === 'end' && s.active].filter(Boolean).join(' ')} style={{ left: `${rangePctEnd}%` }} />
          </>
        )}
      </>
    ) : (
      <>
        {isCompact ? (
          <>
            {tickMarks}
            <div className={s.compactFill} style={{ width: `${singlePct}%` }} />
            <div
              className={[s.compactThumb, isDragging && s.active].filter(Boolean).join(' ')}
              style={{ left: `${singlePct}%` }}
            />
          </>
        ) : (
          <>
            <div className={s.fillClip}>
              <div className={s.fill} style={{ width: `${singlePct}%` }} />
            </div>
            <div className={s.tickLayer}>{tickMarks}</div>
            <div className={[s.indicator, isDragging && s.active].filter(Boolean).join(' ')} style={{ left: `${singlePct}%` }} />
          </>
        )}
      </>
    );

    // --- Build body row ---
    // Compute all possible formatted values to size the label stably
    const sizingValues = useMemo(() => {
      const vals = new Set<number>([min, max]);
      if (tickValues) tickValues.forEach((v) => vals.add(v));
      // Also add step-based boundary samples
      vals.add(min + step);
      vals.add(max - step);
      return Array.from(vals).map(fmt);
    }, [min, max, step, tickValues, fmt]);

    const stableLabel = (content: string) => (
      <span className={s.valueLabel}>
        {/* Invisible sizing content */}
        <span className={s.valueSizer}>
          {sizingValues.map((v, i) => (
            <span key={i} aria-hidden>{v}</span>
          ))}
        </span>
        {/* Visible value */}
        <span className={s.valueVisible}>{content}</span>
      </span>
    );

    const valueDisplay = showValue && stableLabel(
      range ? fmt(currentRange[0]) : fmt(currentValue),
    );

    const trailValueDisplay = showValue && range && stableLabel(
      fmt(currentRange[1]),
    );

    const trackElement = isCompact ? (
      <div
        ref={trackRef}
        className={s.compactTrack}
        {...ariaProps}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onFocus={!range ? () => setFocused(true) : undefined}
        onBlur={!range ? () => setFocused(false) : undefined}
        onKeyDown={!range ? handleKeyDown : undefined}
      >
        {trackContent}
      </div>
    ) : (
      <div
        ref={trackRef}
        className={s.track}
        {...ariaProps}
      >
        {trackContent}
      </div>
    );

    const bodyRow = isCompact ? (
      <div className={s.bodyRow}>
        {leadSlot && showLeadSlot && (
          <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{leadSlot}</div>
        )}
        {valueDisplay}
        {trackElement}
        {trailValueDisplay}
        {trailSlot && showTrailSlot && (
          <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{trailSlot}</div>
        )}
        {hasError && (
          <div className={s.errorIcon}>
            <IconBox icon={AlertCircleIcon} />
          </div>
        )}
      </div>
    ) : (
      /* Field mode: track is absolute over entire field, bodyRow holds spacer + optional slots */
      <>
        {trackElement}
        <div className={s.bodyRow}>
          {leadSlot && showLeadSlot && (
            <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{leadSlot}</div>
          )}
          {valueDisplay}
          <div className={s.trackSpacer} />
          {trailValueDisplay || (showValue && !range && (
            <span className={s.valueLabel} style={{ visibility: 'hidden' }}>{fmt(max)}</span>
          ))}
          {trailSlot && showTrailSlot && (
            <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{trailSlot}</div>
          )}
          {hasError && (
            <div className={s.errorIcon}>
              <IconBox icon={AlertCircleIcon} />
            </div>
          )}
        </div>
      </>
    );

    // --- Render ---
    // --- Input mode ---
    if (isInput) {
      const isInputInner = variant === 'inner';
      const inputFieldCls = [
        s.field,
        sizeCls,
        s.inputMode,
        isInputInner && s.inner,
        focused && s.focused,
        hasError && s.error,
        disabled && s.disabled,
        isDragging && s.dragging,
        className,
      ]
        .filter(Boolean)
        .join(' ');

      const pct = pctOf(currentValue, min, max);

      const inputRow = (
        <div className={s.inputRow}>
          {leadSlot && showLeadSlot && (
            <div className={s.slot}>{leadSlot}</div>
          )}
          <input
            ref={inputRef}
            className={s.inputNative}
            type="number"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            disabled={disabled}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
          />
          {trailSlot && showTrailSlot && (
            <div className={s.slot}>{trailSlot}</div>
          )}
        </div>
      );

      const trackBar = (
        <div ref={trackRef} className={s.inlineTrack}>
          <div className={s.inlineTrackFill} style={{ width: `${pct}%` }} />
        </div>
      );

      const thumbLayer = (
        <div
          className={s.inlineThumbLayer}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className={[s.inlineTrackThumb, isDragging && s.active].filter(Boolean).join(' ')} style={{ left: `${pct}%` }} />
        </div>
      );

      if (isInputInner) {
        return (
          <TextSizeProvider size={textSize}>
            <div ref={ref} className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
              <div className={[s.inputFieldWrap, isDragging && s.dragging].filter(Boolean).join(' ')}>
                <div
                  className={inputFieldCls}
                  onMouseDown={(e) => {
                    if (e.target !== inputRef.current) {
                      e.preventDefault();
                      inputRef.current?.focus();
                    }
                  }}
                >
                  <div className={s.innerTop}>
                    {labelBlock}
                    {inputRow}
                  </div>
                  {hasCaptionContent ? (
                    <>
                      <div className={s.inlineTrackWrap}>
                        {trackBar}
                        {thumbLayer}
                      </div>
                      <div className={s.captionInner}>
                        {captionContent}
                      </div>
                    </>
                  ) : (
                    trackBar
                  )}
                </div>
                {/* Thumb outside field when no caption — not clipped */}
                {!hasCaptionContent && thumbLayer}
              </div>
            </div>
          </TextSizeProvider>
        );
      }

      return (
        <TextSizeProvider size={textSize}>
          <div ref={ref} className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
            {showLabel && label && (
              <div className={[s.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
                <span className={s.label}>{label}</span>
                {labelAction}
              </div>
            )}

            <div className={[s.inputFieldWrap, isDragging && s.dragging].filter(Boolean).join(' ')}>
              <div
                className={inputFieldCls}
                onMouseDown={(e) => {
                  if (e.target !== inputRef.current) {
                    e.preventDefault();
                    inputRef.current?.focus();
                  }
                }}
              >
                {inputRow}
                {trackBar}
              </div>
              {thumbLayer}
            </div>

            {captionContent}
          </div>
        </TextSizeProvider>
      );
    }

    if (isCompact) {
      const compactCls = [
        s.compactField,
        sizeCls,
        hasError && s.error,
        disabled && s.disabled,
        isDragging && s.dragging,
        className,
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <TextSizeProvider size={textSize}>
          <div ref={ref} className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
            {labelBlock}
            <div className={compactCls}>
              {bodyRow}
            </div>
            {captionContent}
          </div>
        </TextSizeProvider>
      );
    }

    // Field mode
    const fieldCls = [
      s.field,
      sizeCls,
      isInner && s.inner,
      focused && s.focused,
      hasError && s.error,
      disabled && s.disabled,
      isDragging && s.dragging,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <TextSizeProvider size={textSize}>
        <div ref={ref} className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
          {!isInner && labelBlock}

          <div
            className={fieldCls}
            style={isInner ? {
              ...(showLabel && label ? { '--fui-slider-label-offset': 'calc(var(--fui-current-line-height) + 4px)' } : {}),
              ...(hasCaptionContent ? { '--fui-slider-caption-offset': 'calc(var(--fui-current-line-height) + var(--fui-current-pad-v) + 1px)' } : {}),
            } as React.CSSProperties : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onFocus={!range ? () => setFocused(true) : undefined}
            onBlur={!range ? () => setFocused(false) : undefined}
            onKeyDown={!range ? handleKeyDown : undefined}
          >
            {isInner ? (
              <>
                <div className={s.innerTop}>
                  {labelBlock}
                  {bodyRow}
                </div>
                {hasCaptionContent && (
                  <div className={s.captionInner}>
                    {captionContent}
                  </div>
                )}
              </>
            ) : (
              bodyRow
            )}
          </div>

          {!isInner && captionContent}
        </div>
      </TextSizeProvider>
    );
  },
);

Slider.displayName = 'Slider';
