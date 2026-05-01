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
  useMemo,
  useLayoutEffect,
} from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon, Add01Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { ChevronDownIcon } from '../Button/ChevronDownIcon';
import { MenuItem } from '../Menu/MenuItem';
import { Tag, type TagPadSize } from '../Tag/Tag';
import { Dropdown } from '../Dropdown/Dropdown';
import s from './Combobox.module.css';
import { PAD_CLASS, TEXT_CLASS, MENU_ITEM_HEIGHT, type PadSize, type TextSize } from '../../tokens/size';

/** Tag padSize per field padSize — tag height must equal field line-height */
const TAG_PAD: Record<PadSize, TagPadSize> = { lg: 'sm', md: 'xs', sm: 'xs' };

/* ─── Types ─── */

export type ComboboxMode = 'single' | 'multi';
export type ComboboxTagsPosition = 'inside' | 'below';
export type ComboboxMenuTrigger = 'focus' | 'input' | 'manual';

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
  iconLeft?: IconSvgElement;
}

interface ComboboxBaseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  padSize?: PadSize;
  textSize?: TextSize;
  /** Text size override for label zone (inherits textSize if omitted) */
  labelTextSize?: TextSize;
  /** Text size override for caption/error zone (inherits textSize if omitted) */
  captionTextSize?: TextSize;
  showLabel?: boolean;
  label?: string;
  labelAction?: ReactNode;
  showCaption?: boolean;
  caption?: string;
  errorMessage?: string;
  placeholder?: string;
  leadSlot?: ReactNode;
  showLeadSlot?: boolean;
  wrapperClassName?: string;
  disabled?: boolean;
  /** Max visible items in dropdown. Default: 6 */
  maxVisible?: number;
  /** Predefined suggestions (optional — can be empty for pure free-form) */
  options?: ComboboxOption[];
  /** Label for the create option. Receives typed text. Default: (v) => `Create "${v}"` */
  formatCreateLabel?: (inputValue: string) => string;
  /** When the dropdown opens. Default: 'focus' */
  menuTrigger?: ComboboxMenuTrigger;
}

export interface ComboboxSingleProps extends ComboboxBaseProps {
  mode?: 'single';
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export interface ComboboxMultiProps extends ComboboxBaseProps {
  mode: 'multi';
  /** Where to render tags. Default: 'inside' */
  tagsPosition?: ComboboxTagsPosition;
  /** Characters that trigger tag creation (e.g. [',']). Multi mode only */
  tokenSeparators?: string[];
  /** Max visible lines of tags before showing +N. Default: unlimited (0) */
  maxTagLines?: number;
  value?: Set<string>;
  defaultValue?: Set<string>;
  onChange?: (value: Set<string>) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultiProps;

/* ─── Component ─── */

export const Combobox = forwardRef<HTMLDivElement, ComboboxProps>(
  (props, ref) => {
    const {
      padSize = 'md',
      textSize = 14,
      labelTextSize,
      captionTextSize,
      showLabel = true,
      label,
      labelAction,
      showCaption = true,
      caption,
      errorMessage,
      placeholder,
      leadSlot,
      showLeadSlot = true,
      wrapperClassName,
      className,
      disabled,
      maxVisible = 6,
      options = [],
      formatCreateLabel = (v: string) => `Create "${v}"`,
      menuTrigger = 'focus',
      ...rest
    } = props;

    const mode: ComboboxMode = (props as ComboboxMultiProps).mode === 'multi' ? 'multi' : 'single';
    const tagsPosition: ComboboxTagsPosition = mode === 'multi'
      ? ((props as ComboboxMultiProps).tagsPosition ?? 'inside')
      : 'inside';
    const tokenSeparators = mode === 'multi'
      ? ((props as ComboboxMultiProps).tokenSeparators ?? [])
      : [];
    const maxTagLines = mode === 'multi'
      ? ((props as ComboboxMultiProps).maxTagLines ?? 0)
      : 0;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const tagsWrapRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => fieldRef.current!);

    const [openState, setOpenState] = useState(false);
    const open = openState && !disabled;
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [search, setSearch] = useState('');
    const [overflowCount, setOverflowCount] = useState(0);
    /** Guards against blur overwriting search after commitValue already set it */
    const justCommittedRef = useRef(false);
    /** True after focus until user edits — suppresses filtering so all options show */
    const [pristineFocus, setPristineFocus] = useState(false);

    /* ─── Value state ─── */

    const [internalSingle, setInternalSingle] = useState<string>(
      mode === 'single' ? ((props as ComboboxSingleProps).defaultValue ?? '') : '',
    );
    const [internalMulti, setInternalMulti] = useState<Set<string>>(
      mode === 'multi' ? ((props as ComboboxMultiProps).defaultValue ?? new Set()) : new Set(),
    );

    const isControlled = props.value !== undefined;

    const currentSingle = mode === 'single'
      ? (isControlled ? (props as ComboboxSingleProps).value! : internalSingle)
      : '';

    const currentMulti = mode === 'multi'
      ? (isControlled ? (props as ComboboxMultiProps).value! : internalMulti)
      : new Set<string>();

    const uid = useId();
    const labelId = `${uid}-label`;
    const listboxId = `${uid}-listbox`;
    const captionId = `${uid}-caption`;
    const liveId = `${uid}-live`;

    const hasErrorMessage = !!errorMessage;
    const hasErrorStyle = hasErrorMessage;
    const hasCaptionAria = hasErrorMessage || (showCaption && !!caption);

    const fieldAnchorRef = useRef<HTMLDivElement>(null);
    const scrollToIndex = useRef<number | null>(null);

    /* ─── Value helpers ─── */

    const setSingleValue = useCallback(
      (val: string) => {
        if (mode !== 'single') return;
        if (!isControlled) setInternalSingle(val);
        (props as ComboboxSingleProps).onChange?.(val);
      },
      [mode, isControlled, (props as ComboboxSingleProps).onChange],
    );

    const updateMulti = useCallback(
      (next: Set<string>) => {
        if (mode !== 'multi') return;
        if (!isControlled) setInternalMulti(next);
        (props as ComboboxMultiProps).onChange?.(next);
      },
      [mode, isControlled, (props as ComboboxMultiProps).onChange],
    );

    const addMultiValue = useCallback(
      (val: string) => {
        const next = new Set(currentMulti);
        next.add(val);
        updateMulti(next);
      },
      [currentMulti, updateMulti],
    );

    const removeMultiValue = useCallback(
      (val: string) => {
        const next = new Set(currentMulti);
        next.delete(val);
        updateMulti(next);
      },
      [currentMulti, updateMulti],
    );

    const toggleMultiValue = useCallback(
      (val: string) => {
        const next = new Set(currentMulti);
        if (next.has(val)) next.delete(val); else next.add(val);
        updateMulti(next);
      },
      [currentMulti, updateMulti],
    );

    const clearAll = useCallback(() => {
      if (mode === 'single') {
        setSingleValue('');
        setSearch('');
      } else {
        updateMulti(new Set());
      }
    }, [mode, setSingleValue, updateMulti]);

    /* ─── Label resolution ─── */

    const labelMap = useMemo(() => {
      const map: Record<string, string> = {};
      for (const opt of options) map[opt.value] = opt.label;
      return map;
    }, [options]);

    const iconMap = useMemo(() => {
      const map: Record<string, IconSvgElement> = {};
      for (const opt of options) {
        if (opt.iconLeft) map[opt.value] = opt.iconLeft;
      }
      return map;
    }, [options]);

    /* ─── Ordered multi values ─── */

    const orderedMultiValues = useMemo(() => {
      if (mode !== 'multi') return [];
      const optionOrder = options.filter((o) => currentMulti.has(o.value)).map((o) => o.value);
      const freeForm = [...currentMulti].filter((v) => !options.some((o) => o.value === v));
      return [...optionOrder, ...freeForm];
    }, [mode, options, currentMulti]);

    /* ─── Filtered options ─── */

    const filteredOptions = useMemo(() => {
      // After focus in single mode, show all options until user starts editing
      if (pristineFocus) return options;
      if (!search) return options;
      const q = search.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, search, pristineFocus]);

    const hasFilteredOptions = filteredOptions.length > 0;

    /** Whether the search text exactly matches an existing option value/label */
    const searchMatchesExisting = useMemo(() => {
      if (!search.trim()) return false;
      const q = search.trim().toLowerCase();
      return options.some((o) => o.label.toLowerCase() === q || o.value.toLowerCase() === q);
    }, [search, options]);

    /** Whether the search text is already in the multi value set */
    const searchAlreadyAdded = useMemo(() => {
      if (mode !== 'multi' || !search.trim()) return false;
      return currentMulti.has(search.trim());
    }, [mode, search, currentMulti]);

    /** In single mode, suppress "Create" when search matches the current value (user hasn't edited) */
    const searchMatchesCurrent = mode === 'single' && !!currentSingle
      && search.trim().toLowerCase() === (labelMap[currentSingle] ?? currentSingle).toLowerCase();

    /** Show create option when: has search, doesn't match existing, not already added, not current value, user is actively editing */
    const showCreateOption = !pristineFocus && !!search.trim() && !searchMatchesExisting && !searchAlreadyAdded && !searchMatchesCurrent;

    /** Total options count for dropdown (filtered + create) */
    const totalDropdownItems = filteredOptions.length + (showCreateOption ? 1 : 0);
    const createOptionIndex = showCreateOption ? filteredOptions.length : -1;

    /* ─── Live region text ─── */

    const [liveText, setLiveText] = useState('');

    useEffect(() => {
      if (!open) { setLiveText(''); return; }
      const count = filteredOptions.length;
      if (count === 0 && showCreateOption) {
        setLiveText('No matches. Press Enter to create.');
      } else if (count === 0) {
        setLiveText('No results found.');
      } else if (count === 1) {
        setLiveText('1 result available.');
      } else {
        setLiveText(`${count} results available.`);
      }
    }, [open, filteredOptions.length, showCreateOption]);

    /* ─── Toggle / open ─── */

    const openDropdown = useCallback(() => {
      if (disabled) return;
      setOpenState(true);
      setHighlightIndex(-1);
    }, [disabled]);

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

    /* ─── Commit value (Enter or click) ─── */

    const commitValue = useCallback(
      (val: string) => {
        if (mode === 'single') {
          setSingleValue(val);
          setSearch(labelMap[val] ?? val);
          setOpenState(false);
          justCommittedRef.current = true;
          inputRef.current?.blur();
        } else {
          addMultiValue(val);
          setSearch('');
          setHighlightIndex(-1);
          inputRef.current?.focus();
        }
      },
      [mode, setSingleValue, addMultiValue, labelMap],
    );

    const commitFreeForm = useCallback(() => {
      const raw = search.trim();
      if (!raw) return;

      // Split by token separators in multi mode before committing
      if (mode === 'multi' && tokenSeparators.length > 0) {
        const hasSep = tokenSeparators.some((sep) => raw.includes(sep));
        if (hasSep) {
          // Split by all separators at once via regex
          const escapedSeps = tokenSeparators.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          const re = new RegExp(`[${escapedSeps.join('')}]`);
          const parts = raw.split(re).map((p) => p.trim()).filter(Boolean);

          // Batch update: create a single new Set with all tags
          const next = new Set(currentMulti);
          for (const tag of parts) next.add(tag);
          updateMulti(next);

          setSearch('');
          setHighlightIndex(-1);
          inputRef.current?.focus();
          return;
        }
      }

      commitValue(raw);
    }, [search, commitValue, mode, tokenSeparators, currentMulti, updateMulti]);

    /* ─── Token separators (multi mode) ─── */

    const processTokenSeparators = useCallback(
      (text: string): string => {
        if (mode !== 'multi' || tokenSeparators.length === 0) return text;

        const escapedSeps = tokenSeparators.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const re = new RegExp(`[${escapedSeps.join('')}]`);
        if (!re.test(text)) return text;

        const parts = text.split(re);
        const remaining = parts.pop() ?? '';
        const tags = parts.map((p) => p.trim()).filter(Boolean);

        if (tags.length > 0) {
          const next = new Set(currentMulti);
          for (const tag of tags) next.add(tag);
          updateMulti(next);
        }

        return remaining;
      },
      [mode, tokenSeparators, currentMulti, updateMulti],
    );

    /* ─── Keyboard ─── */

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        const maxIdx = totalDropdownItems - 1;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            if (!open) { openDropdown(); return; }
            setHighlightIndex((prev) => {
              // Skip disabled options in filtered list
              for (let i = prev + 1; i <= maxIdx; i++) {
                if (i === createOptionIndex) { scrollToIndex.current = i; return i; }
                if (i < filteredOptions.length && !filteredOptions[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;

          case 'ArrowUp':
            e.preventDefault();
            if (!open) { openDropdown(); return; }
            setHighlightIndex((prev) => {
              const start = prev < 0 ? maxIdx + 1 : prev;
              for (let i = start - 1; i >= 0; i--) {
                if (i === createOptionIndex) { scrollToIndex.current = i; return i; }
                if (i < filteredOptions.length && !filteredOptions[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;

          case 'Enter':
            e.preventDefault();
            if (highlightIndex === createOptionIndex && showCreateOption) {
              // Create option selected
              commitFreeForm();
            } else if (highlightIndex >= 0 && highlightIndex < filteredOptions.length && !filteredOptions[highlightIndex].disabled) {
              if (mode === 'single') {
                commitValue(filteredOptions[highlightIndex].value);
              } else {
                toggleMultiValue(filteredOptions[highlightIndex].value);
                setSearch('');
                setHighlightIndex(-1);
                inputRef.current?.focus();
              }
            } else if (search.trim()) {
              commitFreeForm();
            }
            break;

          case 'Escape':
            e.preventDefault();
            setOpenState(false);
            if (mode === 'single') {
              // Restore display value
              setSearch(currentSingle ? (labelMap[currentSingle] ?? currentSingle) : '');
            } else {
              setSearch('');
            }
            inputRef.current?.focus();
            break;

          case 'Tab':
            setOpenState(false);
            if (mode === 'single') {
              setSearch(currentSingle ? (labelMap[currentSingle] ?? currentSingle) : '');
            } else {
              setSearch('');
            }
            break;

          case 'Backspace':
            if (mode === 'multi' && search === '' && orderedMultiValues.length > 0) {
              removeMultiValue(orderedMultiValues[orderedMultiValues.length - 1]);
            }
            break;
        }
      },
      [disabled, open, openDropdown, filteredOptions, highlightIndex, mode, search, commitValue, commitFreeForm, toggleMultiValue, orderedMultiValues, removeMultiValue, totalDropdownItems, createOptionIndex, showCreateOption, currentSingle, labelMap],
    );

    /* ─── Input handlers ─── */

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        // User started editing — enable filtering
        if (pristineFocus) setPristineFocus(false);

        setSearch(val);
        if (menuTrigger !== 'manual' && !open) setOpenState(true);
        setHighlightIndex(-1);
      },
      [open, menuTrigger, pristineFocus],
    );

    const handleInputFocus = useCallback(() => {
      if (menuTrigger === 'focus' && !open && !disabled) setOpenState(true);
    }, [open, disabled, menuTrigger]);

    /** Handle paste — split by token separators in multi mode */
    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (mode !== 'multi' || tokenSeparators.length === 0) return;

        const pasted = e.clipboardData.getData('text');
        let hasTokens = false;
        for (const sep of tokenSeparators) {
          if (pasted.includes(sep)) { hasTokens = true; break; }
        }
        if (!hasTokens) return;

        e.preventDefault();
        const remaining = processTokenSeparators(pasted);
        setSearch(remaining);
      },
      [mode, tokenSeparators, processTokenSeparators],
    );

    /* ─── Render helpers ─── */

    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    const fieldCls = [
      s.field,
      sizeCls,
      hasErrorStyle && s.error,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const labelBlock = showLabel && label && (
      <div className={[s.labelRow, labelTextSize && TEXT_CLASS[labelTextSize]].filter(Boolean).join(' ')}>
        <span id={labelId} className={s.label}>{label}</span>
        {labelAction}
      </div>
    );

    const hasValue = mode === 'single' ? !!currentSingle : currentMulti.size > 0;

    /* ─── Single mode display ─── */

    const singleDisplayValue = mode === 'single'
      ? (labelMap[currentSingle] ?? currentSingle)
      : '';

    const handleFieldClick = useCallback(() => {
      if (disabled) return;
      inputRef.current?.focus();
    }, [disabled]);

    const handleSingleFocus = useCallback(() => {
      if (mode === 'single') {
        // Show current value as editable text; pristineFocus shows all options until user edits
        if (currentSingle) {
          setSearch(singleDisplayValue);
          setPristineFocus(true);
          // Place caret at end — user can clear all via the clear button
          setTimeout(() => {
            const input = inputRef.current;
            if (input) {
              const len = input.value.length;
              input.setSelectionRange(len, len);
            }
          }, 0);
        }
      }
      handleInputFocus();
    }, [mode, currentSingle, singleDisplayValue, handleInputFocus]);

    const handleBlur = useCallback(() => {
      // Delay to allow click events on dropdown items to fire first
      setTimeout(() => {
        // commitValue already set search to the correct display value — skip
        if (justCommittedRef.current) {
          justCommittedRef.current = false;
          return;
        }
        // If focus is still inside the wrapper (user clicked inside), don't reset
        if (wrapperRef.current?.contains(document.activeElement)) return;
        if (mode === 'single') {
          setSearch(currentSingle ? (labelMap[currentSingle] ?? currentSingle) : '');
          setPristineFocus(false);
        } else {
          // On blur in multi mode: split by separators and commit all parts as tags
          const current = inputRef.current?.value ?? '';
          if (current.trim() && tokenSeparators.length > 0) {
            const escapedSeps = tokenSeparators.map((sep) => sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const re = new RegExp(`[${escapedSeps.join('')}]`);
            const parts = current.split(re).map((p) => p.trim()).filter(Boolean);
            if (parts.length > 0) {
              const next = new Set(currentMulti);
              for (const tag of parts) next.add(tag);
              updateMulti(next);
            }
          } else if (current.trim()) {
            addMultiValue(current.trim());
          }
          setSearch('');
        }
        setOpenState(false);
      }, 100);
    }, [mode, currentSingle, currentMulti, labelMap, tokenSeparators, updateMulti, addMultiValue]);

    /* ─── Build input element ─── */

    const inputPlaceholder = !hasValue ? placeholder : undefined;

    // Highlighted option id for aria-activedescendant
    const activeDescendantId = open && highlightIndex >= 0
      ? (highlightIndex === createOptionIndex ? `${uid}-create` : `${uid}-opt-${highlightIndex}`)
      : undefined;

    const inputElement = (
      <input
        ref={inputRef}
        className={s.input}
        type="text"
        spellCheck={false}
        autoComplete="off"
        value={search}
        placeholder={inputPlaceholder}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={mode === 'single' ? handleSingleFocus : handleInputFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onClick={(e) => e.stopPropagation()}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendantId}
        aria-labelledby={showLabel && label ? labelId : undefined}
        aria-describedby={hasCaptionAria ? captionId : undefined}
      />
    );

    /* ─── Multi mode: tag elements ─── */

    const tagElements = mode === 'multi' ? orderedMultiValues.map((val) => (
      <Tag
        key={val}
        padSize={TAG_PAD[padSize]}
        textSize={12}
        variant="filled"
        status="neutral"
        icon={iconMap[val]}
        closable
        onClose={() => removeMultiValue(val)}
      >
        {labelMap[val] ?? val}
      </Tag>
    )) : null;

    /* ─── maxTagLines overflow calculation ─── */

    const [visibleTagCount, setVisibleTagCount] = useState(orderedMultiValues.length);

    useLayoutEffect(() => {
      if (mode !== 'multi' || maxTagLines <= 0 || !tagsWrapRef.current) {
        setVisibleTagCount(orderedMultiValues.length);
        setOverflowCount(0);
        return;
      }

      const wrap = tagsWrapRef.current;
      const children = Array.from(wrap.children).filter(
        (el) => !(el as HTMLElement).dataset.overflow && !(el as HTMLElement).dataset.input,
      );
      if (children.length === 0) {
        setVisibleTagCount(0);
        setOverflowCount(0);
        return;
      }

      // Temporarily show all tags to measure
      wrap.style.maxHeight = 'none';
      wrap.style.overflow = 'visible';

      // Get line height from first tag
      const firstTag = children[0] as HTMLElement;
      const tagHeight = firstTag.offsetHeight;
      const gap = 4; // gap from CSS
      const maxHeight = tagHeight * maxTagLines + gap * (maxTagLines - 1);

      let visible = 0;
      for (const child of children) {
        const el = child as HTMLElement;
        if (el.offsetTop + el.offsetHeight > maxHeight + wrap.offsetTop) break;
        visible++;
      }

      // Restore
      wrap.style.maxHeight = '';
      wrap.style.overflow = '';

      const overflow = orderedMultiValues.length - visible;
      setVisibleTagCount(visible);
      setOverflowCount(overflow);
    }, [mode, maxTagLines, orderedMultiValues.length, padSize]);

    const visibleTags = maxTagLines > 0 && tagElements
      ? tagElements.slice(0, visibleTagCount)
      : tagElements;

    /* ─── Value content ─── */

    let valueContent: ReactNode;

    if (mode === 'multi') {
      if (tagsPosition === 'inside') {
        valueContent = (
          <div ref={tagsWrapRef} className={s.tagsWrap}>
            {visibleTags}
            {overflowCount > 0 && (
              <span data-overflow className={s.overflowCount}>+{overflowCount}</span>
            )}
            {inputElement}
          </div>
        );
      } else {
        valueContent = inputElement;
      }
    } else {
      valueContent = inputElement;
    }

    const bodyRow = (
      <div className={s.bodyRow}>
        {leadSlot && showLeadSlot && (
          <div className={s.slot}>{leadSlot}</div>
        )}
        {valueContent}
        <div className={[s.actions, sizeCls].filter(Boolean).join(' ')}>
          {hasValue && (
            <IconBox
              icon={Cancel01Icon}
              behavior="highlight"
              className={s.clearBtn}
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
                inputRef.current?.focus();
              }}
              aria-label="Clear all"
              tabIndex={-1}
              disabled={disabled}
            />
          )}
          <ChevronDownIcon className={[s.chevron, open && s.chevronOpen].filter(Boolean).join(' ')} />
          {hasErrorStyle && (
            <div className={s.errorIcon}>
              <IconBox icon={AlertCircleIcon} />
            </div>
          )}
        </div>
      </div>
    );

    const captionZoneCls = captionTextSize ? TEXT_CLASS[captionTextSize] : undefined;

    const captionContent = (
      <>
        {hasErrorMessage && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span id={captionId} className={s.errorMessage}>{errorMessage}</span>
          </div>
        )}
        {!hasErrorMessage && showCaption && caption && (
          <div className={[s.captionRow, captionZoneCls].filter(Boolean).join(' ')}>
            <span id={captionId} className={s.caption}>{caption}</span>
          </div>
        )}
      </>
    );

    /* ─── Dropdown content ─── */

    const dropdownItems: ReactNode[] = [];

    if (mode === 'single') {
      filteredOptions.forEach((opt, i) => {
        dropdownItems.push(
          <MenuItem
            key={opt.value}
            id={`${uid}-opt-${i}`}
            padSize={padSize}
            textSize={textSize}
            selected={opt.value === currentSingle}
            disabled={opt.disabled}
            iconLeft={opt.iconLeft}
            className={i === highlightIndex ? s.optionHighlighted : undefined}
            onMouseEnter={() => !opt.disabled && setHighlightIndex(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!opt.disabled) commitValue(opt.value);
            }}
            aria-selected={i === highlightIndex || undefined}
          >
            {opt.label}
          </MenuItem>,
        );
      });
    } else {
      filteredOptions.forEach((opt, i) => {
        dropdownItems.push(
          <MenuItem
            key={opt.value}
            id={`${uid}-opt-${i}`}
            padSize={padSize}
            textSize={textSize}
            selector="checkbox"
            checked={currentMulti.has(opt.value)}
            onCheckedChange={() => {
              toggleMultiValue(opt.value);
              setSearch('');
              setHighlightIndex(-1);
              inputRef.current?.focus();
            }}
            disabled={opt.disabled}
            className={i === highlightIndex ? s.optionHighlighted : undefined}
            onMouseEnter={() => !opt.disabled && setHighlightIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            aria-selected={i === highlightIndex || undefined}
          >
            {opt.label}
          </MenuItem>,
        );
      });
    }

    // "Create" option
    if (showCreateOption) {
      dropdownItems.push(
        <MenuItem
          key="__create__"
          id={`${uid}-create`}
          padSize={padSize}
          textSize={textSize}
          iconLeft={Add01Icon}
          className={createOptionIndex === highlightIndex ? s.optionHighlighted : undefined}
          onMouseEnter={() => setHighlightIndex(createOptionIndex)}
          onMouseDown={(e) => {
            e.preventDefault();
            commitFreeForm();
          }}
          aria-selected={createOptionIndex === highlightIndex || undefined}
        >
          {formatCreateLabel(search.trim())}
        </MenuItem>,
      );
    }

    // Empty state should never appear since combobox is always creatable,
    // but keep as safety net for edge cases (e.g. value already added)
    if (!hasFilteredOptions && !showCreateOption && search.trim()) {
      dropdownItems.push(
        <div key="__empty__" className={[s.emptyState, sizeCls].filter(Boolean).join(' ')}>
          No matches found
        </div>,
      );
    }

    const showDropdown = open && (dropdownItems.length > 0 || !!search.trim());

    // Strip mode-specific props from rest to avoid passing to DOM
    const {
      mode: _mode,
      value: _value,
      defaultValue: _defaultValue,
      onChange: _onChange,
      tagsPosition: _tagsPosition,
      tokenSeparators: _tokenSeparators,
      maxTagLines: _maxTagLines,
      ...domRest
    } = rest as Record<string, unknown>;

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={wrapperRef}
          className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}
          onKeyDown={handleKeyDown}
          {...(domRest as HTMLAttributes<HTMLDivElement>)}
        >
          {labelBlock}

          <div ref={fieldAnchorRef} className={s.fieldAnchor}>
            <div
              ref={fieldRef}
              className={fieldCls}
              tabIndex={-1}
              aria-disabled={disabled || undefined}
              onClick={handleFieldClick}
            >
              {bodyRow}
            </div>
          </div>

          {captionContent}

          {mode === 'multi' && tagsPosition === 'below' && hasValue && (
            <div className={s.tagsBelow}>
              {visibleTags}
              {overflowCount > 0 && (
                <span className={s.overflowCount}>+{overflowCount}</span>
              )}
            </div>
          )}

          {/* Live region for screen readers */}
          <div id={liveId} role="status" aria-live="polite" aria-atomic="true" className={s.srOnly}>
            {liveText}
          </div>

          <Dropdown
            anchorRef={fieldAnchorRef}
            open={showDropdown}
            onClose={() => setOpenState(false)}
            itemHeight={MENU_ITEM_HEIGHT[padSize]}
            maxVisible={maxVisible}
            matchWidth={8}
            offsetX={-4}
            scrollRef={listRef}
            outsideRefs={[wrapperRef]}
            scrollProps={{ id: listboxId, role: 'listbox', 'aria-multiselectable': mode === 'multi' ? true : undefined, onMouseLeave: () => setHighlightIndex(-1) } as React.HTMLAttributes<HTMLDivElement>}
          >
            {dropdownItems}
          </Dropdown>
        </div>
      </TextSizeProvider>
    );
  },
);

Combobox.displayName = 'Combobox';
