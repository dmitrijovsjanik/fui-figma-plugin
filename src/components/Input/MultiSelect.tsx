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
} from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { ChevronDownIcon } from '../Button/ChevronDownIcon';
import { MenuItem } from '../Menu/MenuItem';
import { Tag, type TagPadSize } from '../Tag/Tag';
import { Tree, type TreeNodeData } from '../Tree/Tree';
import { Dropdown } from '../Dropdown/Dropdown';
import s from './MultiSelect.module.css';
import { PAD_CLASS, TEXT_CLASS, MENU_ITEM_HEIGHT, type PadSize, type TextSize } from '../../tokens/size';

/** Tag padSize per field padSize — tag height must equal field line-height to prevent jumps */
const TAG_PAD: Record<PadSize, TagPadSize> = { lg: 'sm', md: 'xs', sm: 'xs' };

/* ─── Types ─── */

export type MultiSelectDisplay = 'text' | 'tags';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  iconLeft?: IconSvgElement;
}

export interface MultiSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
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
  /** Max visible items in dropdown (supports decimals). Default: 6 */
  maxVisible?: number;

  /** Display mode for selected items in the field. Default: 'text' */
  display?: MultiSelectDisplay;

  /* ─── Flat list mode ─── */
  options?: MultiSelectOption[];

  /* ─── Tree mode ─── */
  /** Provide tree nodes instead of flat options */
  treeNodes?: TreeNodeData[];
  /** Default expanded tree node ids */
  treeDefaultExpanded?: Set<string>;

  /* ─── Value ─── */
  /** Controlled selected values */
  value?: Set<string>;
  defaultValue?: Set<string>;
  onChange?: (value: Set<string>) => void;
}

/* ─── Helpers ─── */

/** Collect all leaf ids from a tree (nodes without children) */
function collectLeafIds(nodes: TreeNodeData[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.push(...collectLeafIds(node.children));
    } else {
      ids.push(node.id);
    }
  }
  return ids;
}

/** Build a label map from tree nodes: id → full breadcrumb path */
function buildLabelMap(nodes: TreeNodeData[], parentPath = ''): Record<string, string> {
  const map: Record<string, string> = {};
  for (const node of nodes) {
    const label = typeof node.label === 'string' ? node.label : String(node.label);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    map[node.id] = path;
    if (node.children) {
      Object.assign(map, buildLabelMap(node.children, path));
    }
  }
  return map;
}

/** Build a simple label map from tree nodes: id → label (no path) */
function buildSimpleLabelMap(nodes: TreeNodeData[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const node of nodes) {
    map[node.id] = typeof node.label === 'string' ? node.label : String(node.label);
    if (node.children) {
      Object.assign(map, buildSimpleLabelMap(node.children));
    }
  }
  return map;
}

/* ─── Component ─── */

export const MultiSelect = forwardRef<HTMLDivElement, MultiSelectProps>(
  (
    {
      padSize = 'md',
      textSize = 14,
      labelTextSize,
      captionTextSize,
      display = 'text',
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
      options,
      treeNodes,
      treeDefaultExpanded,
      value,
      defaultValue,
      onChange,
      ...rest
    },
    ref,
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => fieldRef.current!);

    const [openState, setOpenState] = useState(false);
    const open = openState && !disabled;
    const [internalValue, setInternalValue] = useState<Set<string>>(defaultValue ?? new Set());
    const [highlightIndex, setHighlightIndex] = useState(-1);

    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const isTree = !!treeNodes;

    const uid = useId();
    const labelId = `${uid}-label`;
    const listboxId = `${uid}-listbox`;
    const captionId = `${uid}-caption`;

    const hasErrorMessage = !!errorMessage;
    const hasErrorStyle = hasErrorMessage;
    const hasCaptionAria = hasErrorMessage || (showCaption && !!caption);

    const fieldAnchorRef = useRef<HTMLDivElement>(null);

    // Track whether scroll was triggered by keyboard
    const scrollToIndex = useRef<number | null>(null);

    /* ─── Value helpers ─── */

    const updateValue = useCallback(
      (next: Set<string>) => {
        if (!isControlled) setInternalValue(next);
        onChange?.(next);
      },
      [isControlled, onChange],
    );

    const toggleOption = useCallback(
      (val: string) => {
        const next = new Set(currentValue);
        if (next.has(val)) {
          next.delete(val);
        } else {
          next.add(val);
        }
        updateValue(next);
      },
      [currentValue, updateValue],
    );

    const removeValue = useCallback(
      (val: string) => {
        const next = new Set(currentValue);
        next.delete(val);
        updateValue(next);
      },
      [currentValue, updateValue],
    );

    const clearAll = useCallback(() => {
      updateValue(new Set());
    }, [updateValue]);

    /* ─── Label resolution ─── */

    const labelMap = useMemo(() => {
      if (options) {
        const map: Record<string, string> = {};
        for (const opt of options) map[opt.value] = opt.label;
        return map;
      }
      if (treeNodes) return buildSimpleLabelMap(treeNodes);
      return {};
    }, [options, treeNodes]);

    const iconMap = useMemo(() => {
      if (!options) return {};
      const map: Record<string, IconSvgElement> = {};
      for (const opt of options) {
        if (opt.iconLeft) map[opt.value] = opt.iconLeft;
      }
      return map;
    }, [options]);

    const pathMap = useMemo(() => {
      if (treeNodes) return buildLabelMap(treeNodes);
      return labelMap;
    }, [treeNodes, labelMap]);

    /** Ordered selected values (preserve option order, not insertion order) */
    const orderedValues = useMemo(() => {
      if (options) {
        return options.filter((o) => currentValue.has(o.value)).map((o) => o.value);
      }
      if (treeNodes) {
        const leafIds = collectLeafIds(treeNodes);
        return leafIds.filter((id) => currentValue.has(id));
      }
      return [...currentValue];
    }, [options, treeNodes, currentValue]);

    /* ─── Toggle / keyboard ─── */

    const toggle = useCallback(() => {
      if (disabled) return;
      setOpenState((prev) => {
        if (!prev) setHighlightIndex(-1);
        return !prev;
      });
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

        // Tree mode delegates keyboard to Tree component
        if (isTree) {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpenState(false);
            fieldRef.current?.focus();
          } else if (e.key === 'Tab') {
            setOpenState(false);
          }
          return;
        }

        const opts = options ?? [];
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightIndex((prev) => {
              for (let i = prev + 1; i < opts.length; i++) {
                if (!opts[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightIndex((prev) => {
              const start = prev < 0 ? opts.length : prev;
              for (let i = start - 1; i >= 0; i--) {
                if (!opts[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightIndex >= 0 && !opts[highlightIndex]?.disabled) {
              toggleOption(opts[highlightIndex].value);
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
          case 'Backspace':
            if (display === 'tags' && orderedValues.length > 0) {
              removeValue(orderedValues[orderedValues.length - 1]);
            }
            break;
        }
      },
      [disabled, open, toggle, isTree, options, highlightIndex, toggleOption, display, orderedValues, removeValue],
    );

    /* ─── Render helpers ─── */

    const sizeCls = `${PAD_CLASS[padSize]} ${TEXT_CLASS[textSize]}`;

    const fieldCls = [
      s.field,
      sizeCls,
      open && s.focused,
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

    const hasValue = currentValue.size > 0;

    /* ─── Value display ─── */

    const tagElements = orderedValues.map((val) => (
      <Tag
        key={val}
        padSize={TAG_PAD[padSize]}
        textSize={12}
        variant="filled"
        status="neutral"
        icon={iconMap[val]}
        closable
        onClose={() => removeValue(val)}
      >
        {labelMap[val] ?? val}
      </Tag>
    ));

    let valueContent: ReactNode;

    if (display === 'tags') {
      valueContent = (
        <div className={s.tagsWrap} data-placeholder={!hasValue ? (placeholder ?? '') : undefined}>
          {tagElements}
        </div>
      );
    } else {
      const text = orderedValues.map((val) => labelMap[val] ?? val).join(', ');
      valueContent = (
        <span className={[s.valueText, !hasValue && s.placeholder].filter(Boolean).join(' ')}>
          {hasValue ? text : (placeholder ?? '\u00A0')}
        </span>
      );
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

    let dropdownContent: ReactNode;

    if (isTree && treeNodes) {
      dropdownContent = (
        <Tree
          nodes={treeNodes}
          multiSelect
          checkedIds={currentValue}
          onCheckedIdsChange={(ids) => updateValue(ids)}
          defaultExpanded={treeDefaultExpanded}
          padSize={padSize}
          textSize={textSize}
        />
      );
    } else {
      dropdownContent = (options ?? []).map((opt, i) => (
        <MenuItem
          key={opt.value}
          id={`${uid}-opt-${i}`}
          padSize={padSize}
          textSize={textSize}
          selector="checkbox"
          checked={currentValue.has(opt.value)}
          onCheckedChange={() => toggleOption(opt.value)}
          disabled={opt.disabled}
          className={i === highlightIndex ? s.optionHighlighted : undefined}
          onMouseEnter={() => !opt.disabled && setHighlightIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
        >
          {opt.label}
        </MenuItem>
      ));
    }

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={wrapperRef}
          className={[s.wrapper, sizeCls, wrapperClassName].filter(Boolean).join(' ')}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {labelBlock}

          <div ref={fieldAnchorRef} className={s.fieldAnchor}>
            <div
              ref={fieldRef}
              className={fieldCls}
              tabIndex={disabled ? -1 : 0}
              role="combobox"
              aria-expanded={open}
              aria-haspopup={isTree ? 'tree' : 'listbox'}
              aria-controls={open ? listboxId : undefined}
              aria-labelledby={showLabel && label ? labelId : undefined}
              aria-describedby={hasCaptionAria ? captionId : undefined}
              aria-disabled={disabled || undefined}
              onClick={toggle}
            >
              {bodyRow}
            </div>
          </div>

          {captionContent}

          <Dropdown
            anchorRef={fieldAnchorRef}
            open={open}
            onClose={() => setOpenState(false)}
            itemHeight={MENU_ITEM_HEIGHT[padSize]}
            maxVisible={maxVisible}
            matchWidth={8}
            offsetX={-4}
            scrollRef={isTree ? undefined : listRef}
            outsideRefs={[wrapperRef]}
            scrollProps={isTree ? undefined : { id: listboxId, role: 'listbox', onMouseLeave: () => setHighlightIndex(-1) }}
          >
            {dropdownContent}
          </Dropdown>
        </div>
      </TextSizeProvider>
    );
  },
);

MultiSelect.displayName = 'MultiSelect';
