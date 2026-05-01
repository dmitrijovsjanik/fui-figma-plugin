import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
} from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { ChevronDownIcon } from '../Button/ChevronDownIcon';
import { MenuItem } from '../Menu/MenuItem';
import { Dropdown } from '../Dropdown/Dropdown';
import styles from './Select.module.css';
import { PAD_CLASS, TEXT_CLASS, MENU_ITEM_HEIGHT, type PadSize, type TextSize } from '../../tokens/size';

export type SelectVariant = 'default' | 'inner';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  iconLeft?: IconSvgElement;
}

export interface SelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  padSize?: PadSize;
  textSize?: TextSize;
  /** Text size override for label zone (inherits textSize if omitted) */
  labelTextSize?: TextSize;
  /** Text size override for caption/error zone (inherits textSize if omitted) */
  captionTextSize?: TextSize;
  variant?: SelectVariant;
  showLabel?: boolean;
  label?: string;
  labelAction?: ReactNode;
  showCaption?: boolean;
  caption?: string;
  errorMessage?: string;
  options?: SelectOption[];
  placeholder?: string;
  leadSlot?: ReactNode;
  showLeadSlot?: boolean;
  wrapperClassName?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Max visible items in dropdown (supports decimals, e.g. 5.5). Default: 6 */
  maxVisible?: number;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
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
      options = [],
      placeholder,
      leadSlot,
      showLeadSlot = true,
      wrapperClassName,
      className,
      disabled,
      value,
      defaultValue,
      onChange,
      maxVisible = 6,
      ...rest
    },
    ref,
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => fieldRef.current!);

    const [openState, setOpenState] = useState(false);
    const open = openState && !disabled;
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');
    const [highlightIndex, setHighlightIndex] = useState(-1);

    // Reset highlight when options change while open
    const optionsLenRef = useRef(options.length);
    if (optionsLenRef.current !== options.length) {
      optionsLenRef.current = options.length;
      if (open) setHighlightIndex(-1);
    }

    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;
    const selectedOption = options.find((o) => o.value === currentValue);
    const hasValue = currentValue.length > 0;

    const uid = useId();
    const labelId = `${uid}-label`;
    const listboxId = `${uid}-listbox`;
    const captionId = `${uid}-caption`;

    const hasErrorMessage = !!errorMessage;
    const hasErrorStyle = hasErrorMessage;
    const isInner = variant === 'inner';
    const hasCaptionAria = hasErrorMessage || (showCaption && !!caption);

    const fieldAnchorRef = useRef<HTMLDivElement>(null);

    const selectValue = useCallback(
      (val: string) => {
        if (!isControlled) setInternalValue(val);
        onChange?.(val);
        setOpenState(false);
        fieldRef.current?.focus();
      },
      [isControlled, onChange],
    );

    const toggle = useCallback(() => {
      if (disabled) return;
      setOpenState((prev) => {
        if (!prev) {
          setHighlightIndex(-1);
        }
        return !prev;
      });
    }, [disabled]);

    // Track whether scroll was triggered by keyboard (not mouse)
    const scrollToIndex = useRef<number | null>(null);

    // Type-ahead search
    const typeaheadBuf = useRef('');
    const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Scroll selected item into view when dropdown mounts
    const scrollToSelected = useCallback(() => {
      const list = listRef.current;
      if (!list) return;
      const idx = options.findIndex((o) => o.value === currentValue);
      if (idx < 0) return;
      const item = list.children[idx] as HTMLElement | undefined;
      if (!item) return;
      const listPad = parseFloat(getComputedStyle(list).paddingTop) || 0;
      list.scrollTop = item.offsetTop - listPad;
    }, [options, currentValue]);

    // Scroll highlighted item into view on keyboard navigation only
    useEffect(() => {
      if (scrollToIndex.current === null) return;
      const list = listRef.current;
      if (!list) return;
      const item = list.children[scrollToIndex.current] as HTMLElement | undefined;
      scrollToIndex.current = null;
      if (!item) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top < listRect.top) {
        list.scrollTop -= listRect.top - itemRect.top;
      } else if (itemRect.bottom > listRect.bottom) {
        list.scrollTop += itemRect.bottom - listRect.bottom;
      }
    }, [highlightIndex]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!open) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            toggle();
          }
          return;
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightIndex((prev) => {
              for (let i = prev + 1; i < options.length; i++) {
                if (!options[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightIndex((prev) => {
              const start = prev < 0 ? options.length : prev;
              for (let i = start - 1; i >= 0; i--) {
                if (!options[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightIndex >= 0 && !options[highlightIndex]?.disabled) {
              selectValue(options[highlightIndex].value);
            }
            break;
          case 'Escape':
            e.preventDefault();
            setOpenState(false);
            fieldRef.current?.focus();
            break;
          case 'Tab':
            setOpenState(false);
            break;
          default:
            // Type-ahead: single printable character
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              typeaheadBuf.current += e.key.toLowerCase();
              if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
              typeaheadTimer.current = setTimeout(() => { typeaheadBuf.current = ''; }, 500);

              const query = typeaheadBuf.current;
              const idx = options.findIndex(
                (o) => !o.disabled && o.label.toLowerCase().startsWith(query),
              );
              if (idx >= 0) {
                scrollToIndex.current = idx;
                setHighlightIndex(idx);
              }
            }
            break;
        }
      },
      [disabled, open, toggle, highlightIndex, options, selectValue],
    );

    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    const fieldCls = [
      styles.field,
      sizeCls,
      isInner && styles.inner,
      open && styles.focused,
      hasErrorStyle && styles.error,
      disabled && styles.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const labelBlock = showLabel && label && (
      <div className={[styles.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
        <span id={labelId} className={styles.label}>{label}</span>
        {labelAction}
      </div>
    );

    const resolvedLeadSlot = leadSlot ?? (
      selectedOption?.iconLeft
        ? <IconBox icon={selectedOption.iconLeft} />
        : null
    );

    const bodyRow = (
      <div className={styles.bodyRow}>
        {resolvedLeadSlot && showLeadSlot && (
          <div className={styles.slot}>{resolvedLeadSlot}</div>
        )}
        <span className={[styles.value, !hasValue && styles.placeholder].filter(Boolean).join(' ')}>
          {selectedOption?.label ?? placeholder ?? '\u00A0'}
        </span>
        <ChevronDownIcon className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(' ')} />
        {hasErrorStyle && (
          <div className={styles.errorIcon}>
            <IconBox icon={AlertCircleIcon} />
          </div>
        )}
      </div>
    );

    const captionZoneCls = captionTextSize ? TEXT_CLASS[captionTextSize] : undefined;

    const captionContent = (
      <>
        {hasErrorMessage && (
          <div className={[styles.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span id={captionId} className={styles.errorMessage}>{errorMessage}</span>
          </div>
        )}
        {!hasErrorMessage && showCaption && caption && (
          <div className={[styles.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span id={captionId} className={styles.caption}>{caption}</span>
          </div>
        )}
      </>
    );

    const hasCaptionContent = hasErrorMessage || (!hasErrorMessage && showCaption && caption);

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={wrapperRef}
          className={[styles.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {!isInner && labelBlock}

          <div ref={fieldAnchorRef} className={styles.fieldAnchor}>
            <div
              ref={fieldRef}
              className={fieldCls}
              tabIndex={disabled ? -1 : 0}
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={open ? listboxId : undefined}
              aria-labelledby={showLabel && label ? labelId : undefined}
              aria-describedby={hasCaptionAria ? captionId : undefined}
              aria-activedescendant={open && highlightIndex >= 0 ? `${uid}-opt-${highlightIndex}` : undefined}
              aria-disabled={disabled || undefined}
              onClick={toggle}
            >
              {isInner ? (
                <>
                  <div className={styles.innerTop}>
                    {labelBlock}
                    {bodyRow}
                  </div>
                  {hasCaptionContent && (
                    <div className={styles.captionInner}>
                      {captionContent}
                    </div>
                  )}
                </>
              ) : (
                bodyRow
              )}
            </div>
          </div>

          {!isInner && captionContent}

          <Dropdown
            ref={dropdownRef}
            anchorRef={fieldAnchorRef}
            open={open}
            onClose={() => setOpenState(false)}
            itemHeight={MENU_ITEM_HEIGHT[padSize]}
            maxVisible={maxVisible}
            matchWidth={8}
            offsetX={-4}
            scrollRef={listRef}
            outsideRefs={[wrapperRef]}
            scrollProps={{ id: listboxId, role: 'listbox' }}
            onMount={scrollToSelected}
          >
            {options.map((opt, i) => (
              <MenuItem
                key={opt.value}
                id={`${uid}-opt-${i}`}
                padSize={padSize}
                textSize={textSize}
                selected={opt.value === currentValue}
                disabled={opt.disabled}
                iconLeft={opt.iconLeft}
                className={i === highlightIndex ? styles.optionHighlighted : undefined}
                onMouseEnter={() => !opt.disabled && setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!opt.disabled) selectValue(opt.value);
                }}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Dropdown>
        </div>
      </TextSizeProvider>
    );
  },
);

Select.displayName = 'Select';
