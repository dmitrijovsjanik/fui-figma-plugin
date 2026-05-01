import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { Cancel01Icon, AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './TextInline.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type TextInlineVariant = 'default' | 'inner';

export type TextInlineStatus = 'default' | 'error' | 'success';

export interface TextInlineProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children'> {
  padSize?: PadSize;
  textSize?: TextSize;
  /** Text size override for label zone (inherits textSize if omitted) */
  labelTextSize?: TextSize;
  /** Text size override for caption/error/success zone (inherits textSize if omitted) */
  captionTextSize?: TextSize;
  variant?: TextInlineVariant;
  status?: TextInlineStatus;
  showLabel?: boolean;
  label?: string;
  labelAction?: ReactNode;
  showCaption?: boolean;
  caption?: string;
  maxLength?: number;
  errorMessage?: string;
  successMessage?: string;
  clearable?: boolean;
  onClear?: () => void;
  leadText?: string;
  trailText?: string;
  leadSlot?: ReactNode;
  showLeadSlot?: boolean;
  trailSlot?: ReactNode;
  showTrailSlot?: boolean;
  wrapperClassName?: string;
  /** Custom body content replacing the default input. Enables compound fields (e.g. payment inputs). */
  children?: ReactNode;
}

export const TextInline = forwardRef<HTMLInputElement, TextInlineProps>(
  (
    {
      padSize = 'md',
      textSize = 14,
      labelTextSize,
      captionTextSize,
      variant = 'default',
      status: statusProp,
      showLabel = true,
      label,
      labelAction,
      showCaption = true,
      caption,
      maxLength,
      errorMessage,
      successMessage,
      clearable = true,
      onClear,
      leadText,
      trailText,
      leadSlot,
      showLeadSlot = true,
      trailSlot,
      showTrailSlot = true,
      wrapperClassName,
      className,
      disabled,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      children,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current!);

    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');

    // Overflow tooltip
    const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
    const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Clean up tooltip timer on unmount
    useEffect(() => {
      return () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      };
    }, []);

    const isOverflowing = useCallback(() => {
      const el = innerRef.current;
      return el ? el.scrollWidth > el.clientWidth : false;
    }, []);

    const clearTooltip = useCallback(() => {
      if (tooltipTimer.current) { clearTimeout(tooltipTimer.current); tooltipTimer.current = null; }
      setTooltip(null);
    }, []);

    const handleInputMouseMove = useCallback((e: React.MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (focused || !isOverflowing()) { clearTooltip(); return; }
      if (tooltip) {
        setTooltip({ x: e.clientX, y: e.clientY });
      } else if (!tooltipTimer.current) {
        tooltipTimer.current = setTimeout(() => {
          tooltipTimer.current = null;
          setTooltip({ ...mousePos.current });
        }, 600);
      }
    }, [focused, isOverflowing, tooltip, clearTooltip]);


    const isControlled = value !== undefined;
    const currentValue = String(isControlled ? value : internalValue);
    const hasValue = currentValue.length > 0;
    const showClear = clearable && hasValue && (hovered || focused) && !disabled;

    // Counter logic
    const remaining = maxLength !== undefined ? maxLength - currentValue.length : undefined;
    const counterOverflow = remaining !== undefined && remaining < 0;

    // Status resolution: explicit status prop > errorMessage > counterOverflow > success > default
    const hasErrorMessage = !!errorMessage;
    const hasSuccessMessage = !!successMessage;
    const hasErrorStyle = statusProp === 'error' || hasErrorMessage || counterOverflow;
    const hasSuccessStyle = statusProp === 'success' || (!hasErrorStyle && hasSuccessMessage);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isControlled) setInternalValue(e.target.value);
        onChange?.(e);
      },
      [isControlled, onChange],
    );

    const handleClear = useCallback(() => {
      if (!innerRef.current) return;

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(innerRef.current, '');

      const event = new Event('input', { bubbles: true });
      innerRef.current.dispatchEvent(event);

      if (!isControlled) setInternalValue('');
      onClear?.();
      innerRef.current.focus();
    }, [isControlled, onClear]);

    const isInner = variant === 'inner';

    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    const fieldCls = [
      s.field,
      sizeCls,
      isInner && s.inner,
      focused && s.focused,
      hasErrorStyle && s.error,
      hasSuccessStyle && s.success,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    /* Shared pieces */
    const labelBlock = showLabel && label && (
      <div className={[s.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
        <span className={s.label}>{label}</span>
        {labelAction}
      </div>
    );

    const hasCustomBody = children !== undefined;

    const bodyRow = hasCustomBody ? (
      <div className={s.bodyRow}>
        {leadSlot && showLeadSlot && (
          <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{leadSlot}</div>
        )}
        {children}
        {trailSlot && showTrailSlot && (
          <div
            className={`${s.slot} ${s.slotAction}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {trailSlot}
          </div>
        )}
        {hasSuccessStyle && (
          <div className={s.successIcon}>
            <IconBox icon={CheckmarkCircle02Icon} />
          </div>
        )}
        {hasErrorStyle && (
          <div className={s.errorIcon}>
            <IconBox icon={AlertCircleIcon} />
          </div>
        )}
      </div>
    ) : (
      <div className={s.bodyRow}>
        {leadSlot && showLeadSlot && (
          <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{leadSlot}</div>
        )}
        <div className={s.inputWrap}>
          <div className={s.inputContent}>
            {leadText && <span className={s.inlineText}>{leadText}</span>}
            <input
              ref={innerRef}
              className={[s.input, showClear && s.inputClearShift].filter(Boolean).join(' ')}
              disabled={disabled}
              value={isControlled ? value : undefined}
              defaultValue={isControlled ? undefined : defaultValue}
              onChange={handleChange}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
                // Place caret at end on initial focus and scroll to it
                const el = e.currentTarget;
                requestAnimationFrame(() => {
                  const len = el.value.length;
                  el.setSelectionRange(len, len);
                  el.scrollLeft = el.scrollWidth;
                });
                clearTooltip();
              }}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              {...rest}
            />
            {trailText && <span className={s.inlineText}>{trailText}</span>}
          </div>
          {clearable && !disabled && (
            <div
              className={[s.clearBtn, showClear && s.clearBtnVisible].filter(Boolean).join(' ')}
            >
              <IconBox
                icon={Cancel01Icon}
                behavior="highlight"
                onClick={handleClear}
                tabIndex={showClear ? -1 : undefined}
                aria-label="Clear input"
              />
            </div>
          )}
        </div>
        {trailSlot && showTrailSlot && (
          <div
            className={`${s.slot} ${s.slotAction}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {trailSlot}
          </div>
        )}
        {hasSuccessStyle && (
          <div className={s.successIcon}>
            <IconBox icon={CheckmarkCircle02Icon} />
          </div>
        )}
        {hasErrorStyle && (
          <div className={s.errorIcon}>
            <IconBox icon={AlertCircleIcon} />
          </div>
        )}
      </div>
    );

    const captionZoneCls = captionTextSize ? TEXT_CLASS[captionTextSize] : undefined;

    const captionContent = (
      <>
        {hasErrorMessage && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span className={s.errorMessage}>{errorMessage}</span>
          </div>
        )}
        {!hasErrorMessage && hasSuccessMessage && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span className={s.successMessage}>{successMessage}</span>
          </div>
        )}
        {!hasErrorMessage && !hasSuccessMessage && showCaption && (caption || remaining !== undefined) && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            {caption && <span className={s.caption}>{caption}</span>}
            {remaining !== undefined && (
              <span className={[s.counter, counterOverflow && s.counterOverflow].filter(Boolean).join(' ')}>
                {remaining}
              </span>
            )}
          </div>
        )}
      </>
    );

    const hasCaptionContent = hasErrorMessage || hasSuccessMessage || (!hasErrorMessage && !hasSuccessMessage && showCaption && (caption || remaining !== undefined));

    return (
      <TextSizeProvider size={textSize}>
        <div className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
          {/* Label — outside for default, inside for inner */}
          {!isInner && labelBlock}

          {/* Field */}
          <div
            className={fieldCls}
            onMouseDown={(e) => {
              if (hasCustomBody) return;
              if (e.target !== innerRef.current) {
                e.preventDefault();
                const el = innerRef.current;
                if (!el) return;
                el.focus();
                // Place caret at end and scroll to it
                const len = el.value.length;
                el.setSelectionRange(len, len);
                el.scrollLeft = el.scrollWidth;
                // Double-click outside input → select all text
                if (e.detail >= 2) el.select();
              }
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { setHovered(false); clearTooltip(); }}
            onMouseMove={hasCustomBody ? undefined : handleInputMouseMove}
            {...(hasCustomBody ? {
              onFocusCapture: () => setFocused(true),
              onBlurCapture: (e: React.FocusEvent) => {
                // Only blur if focus leaves the field entirely
                if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
              },
            } : {})}
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

          {/* Caption — outside for default */}
          {!isInner && captionContent}

          {/* Overflow tooltip (portal to avoid overflow:hidden clipping) */}
          {tooltip && hasValue && createPortal(
            <div
              className={s.tooltip}
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {currentValue}
            </div>,
            document.body,
          )}
        </div>
      </TextSizeProvider>
    );
  },
);

TextInline.displayName = 'TextInline';

/** Vertical separator for use inside compound TextInline children */
export function InputSeparator() {
  return <div className={s.separator} />;
}

/** CSS class name for bare inputs inside compound TextInline children */
export const inputBareClass = s.inputBare;
