import {
  type TextareaHTMLAttributes,
  type ReactNode,
  forwardRef,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
} from 'react';
import { Cancel01Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './TextArea.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type TextAreaVariant = 'default' | 'inner';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size' | 'rows'> {
  padSize?: PadSize;
  textSize?: TextSize;
  /** Text size override for label zone (inherits textSize if omitted) */
  labelTextSize?: TextSize;
  /** Text size override for caption/error zone (inherits textSize if omitted) */
  captionTextSize?: TextSize;
  variant?: TextAreaVariant;
  /** Auto-expand height to fit content (default true) */
  autoHeight?: boolean;
  /** Number of visible rows (default 3). With autoHeight — minimum rows; without — fixed height */
  rows?: number;
  showLabel?: boolean;
  label?: string;
  labelAction?: ReactNode;
  showCaption?: boolean;
  caption?: string;
  maxLength?: number;
  errorMessage?: string;
  clearable?: boolean;
  onClear?: () => void;
  leadSlot?: ReactNode;
  showLeadSlot?: boolean;
  trailSlot?: ReactNode;
  showTrailSlot?: boolean;
  wrapperClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      padSize = 'md',
      textSize = 14,
      labelTextSize,
      captionTextSize,
      variant = 'default',
      autoHeight = true,
      rows = 3,
      showLabel = true,
      label,
      labelAction,
      showCaption = true,
      caption,
      maxLength,
      errorMessage,
      clearable = false,
      onClear,
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
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current!);

    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');

    const syncHeight = useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoHeight) {
        if (el) el.style.height = '';
        return;
      }
      el.style.minHeight = '0';
      el.style.height = '0';
      const h = el.scrollHeight;
      el.style.minHeight = '';
      el.style.height = `${h}px`;
    }, [autoHeight]);

    useLayoutEffect(() => { syncHeight(); }, [value, autoHeight]); // eslint-disable-line react-hooks/exhaustive-deps

    const isControlled = value !== undefined;
    const currentValue = String(isControlled ? value : internalValue);
    const hasValue = currentValue.length > 0;
    const showClear = clearable && hasValue && (hovered || focused) && !disabled;

    // Counter logic
    const remaining = maxLength !== undefined ? maxLength - currentValue.length : undefined;
    const counterOverflow = remaining !== undefined && remaining < 0;

    // External error from prop or counter overflow
    const hasErrorMessage = !!errorMessage;
    const hasErrorStyle = hasErrorMessage || counterOverflow;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) setInternalValue(e.target.value);
        onChange?.(e);
        syncHeight();
      },
      [isControlled, onChange, syncHeight],
    );

    const handleClear = useCallback(() => {
      if (!innerRef.current) return;

      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeTextAreaValueSetter?.call(innerRef.current, '');

      const event = new Event('input', { bubbles: true });
      innerRef.current.dispatchEvent(event);

      if (!isControlled) setInternalValue('');
      onClear?.();
      innerRef.current.focus();
      syncHeight();
    }, [isControlled, onClear, syncHeight]);

    const isInner = variant === 'inner';

    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    const fieldCls = [
      s.field,
      sizeCls,
      isInner && s.inner,
      focused && s.focused,
      hasErrorStyle && s.error,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const labelBlock = showLabel && label && (
      <div className={[s.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
        <span className={s.label}>{label}</span>
        {labelAction}
      </div>
    );

    const bodyRow = (
      <div className={s.bodyRow}>
        {leadSlot && showLeadSlot && (
          <div className={s.slot} onMouseDown={(e) => e.preventDefault()}>{leadSlot}</div>
        )}
        <textarea
          ref={innerRef}
          className={[s.textarea, autoHeight && s.autoHeight].filter(Boolean).join(' ')}
          style={{ '--area-rows': rows } as React.CSSProperties}
          disabled={disabled}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          onChange={handleChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {showClear && (
          <IconBox
            icon={Cancel01Icon}
            behavior="highlight"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear input"
          />
        )}
        {trailSlot && showTrailSlot && (
          <div
            className={`${s.slot} ${s.slotAction}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {trailSlot}
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
        {!hasErrorMessage && showCaption && (caption || remaining !== undefined) && (
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

    const hasCaptionContent = hasErrorMessage || (!hasErrorMessage && showCaption && (caption || remaining !== undefined));

    return (
      <TextSizeProvider size={textSize}>
        <div className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}>
          {!isInner && labelBlock}

          <div
            className={fieldCls}
            onClick={() => innerRef.current?.focus()}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
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

TextArea.displayName = 'TextArea';
