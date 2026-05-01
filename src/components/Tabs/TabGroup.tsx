import {
  forwardRef,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MoreVerticalIcon,
  Add01Icon,
} from '@hugeicons/core-free-icons';
import s from './Tabs.module.css';
import { MenuItem } from '../Menu/MenuItem';
import { Button } from '../Button/Button';
import { Dropdown } from '../Dropdown/Dropdown';
import { TabItem } from './TabItem';
import {
  type PadSize,
  type TextSize,
  PAD_CLASS,
  TEXT_CLASS,
  MENU_ITEM_HEIGHT,
} from '../../tokens/size';

/* ─── Types ─── */

export type TabsVariant = 'filled' | 'underline';
export type TabsLayout = 'overflow' | 'fill';
const MAX_VISIBLE = 8;

export interface TabItemData {
  /** Unique value identifying this tab */
  value: string;
  /** Label displayed in the tab */
  label: ReactNode;
  /** Icon displayed before the label */
  icon?: IconSvgElement;
  /** Whether this tab can be closed */
  closable?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export type TabGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  /** Tab definitions */
  items: TabItemData[];
  /** Padding density */
  padSize?: PadSize;
  /** Text / icon sizing */
  textSize?: TextSize;
  /** Visual variant */
  variant?: TabsVariant;
  /** Layout mode */
  layout?: TabsLayout;
  /** Controlled active tab value */
  value?: string;
  /** Default active tab value (uncontrolled) */
  defaultValue?: string;
  /** Called when active tab changes */
  onChange?: (value: string) => void;
  /** Called when a closable tab's close button is clicked */
  onClose?: (value: string) => void;
  /** Called when the "+" button is clicked. Shows the add button when provided. */
  onAdd?: () => void;
  /** Aria label for add button */
  addLabel?: string;
  /** Show arrow buttons even without overflow (always visible) */
  showArrows?: boolean;
  /** Show kebab menu button even without overflow */
  showKebab?: boolean;
  /** Make all tabs closable */
  closable?: boolean;
  /** Enable drag-and-drop reordering */
  draggable?: boolean;
  /** Called when a tab is dropped at a new position */
  onReorder?: (fromIndex: number, toIndex: number) => void;
};

/* ─── Component ─── */

export const TabGroup = forwardRef<HTMLDivElement, TabGroupProps>(
  (
    {
      items,
      padSize: padSizeProp,
      textSize: textSizeProp,
      variant = 'filled',
      layout = 'overflow',
      value: valueProp,
      defaultValue,
      onChange,
      onClose,
      onAdd,
      addLabel = 'Add tab',
      showArrows: showArrowsProp = false,
      showKebab: showKebabProp = false,
      closable: closableAll = false,
      draggable: draggableProp = false,
      onReorder,
      className,
      ...rest
    },
    ref,
  ) => {
    const padSize = padSizeProp ?? 'lg';
    const textSize = textSizeProp ?? 16;

    const [internalValue, setInternalValue] = useState(
      defaultValue ?? items[0]?.value ?? '',
    );
    const isControlled = valueProp !== undefined;
    const activeValue = isControlled ? valueProp : internalValue;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const kebabRef = useRef<HTMLButtonElement>(null);
    const [highlightIndex, setHighlightIndex] = useState(-1);

    const isUnderline = variant === 'underline';
    const isFill = layout === 'fill';

    /* ─── Sliding indicator (underline variant) ─── */

    const [indicatorStyle, setIndicatorStyle] = useState<{
      width: number;
      transform: string;
    } | null>(null);

    const syncIndicator = useCallback(() => {
      if (!isUnderline) { setIndicatorStyle(null); return; }
      const scroll = scrollRef.current;
      if (!scroll) return;
      const activeEl = scroll.querySelector(
        `[data-tab-value="${activeValue}"]`,
      ) as HTMLElement | null;
      if (!activeEl) { setIndicatorStyle(null); return; }
      const left = activeEl.offsetLeft;
      const width = activeEl.offsetWidth;
      setIndicatorStyle({ width, transform: `translateX(${left}px)` });
    }, [isUnderline, activeValue]);

    useEffect(() => {
      syncIndicator();
    }, [syncIndicator]);

    useEffect(() => {
      if (!isUnderline) return;
      const el = scrollRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncIndicator);
      ro.observe(el);
      return () => ro.disconnect();
    }, [isUnderline, syncIndicator]);

    /* ─── Overflow detection (only in overflow layout) ─── */

    const showArrows = showArrowsProp || hasOverflow;
    const showKebab = showKebabProp || hasOverflow;

    const checkOverflow = useCallback(() => {
      if (isFill) return;
      const el = scrollRef.current;
      if (!el) return;
      const over = el.scrollWidth > el.clientWidth + 1;
      setHasOverflow(over);
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, [isFill]);

    useEffect(() => {
      if (isFill) { setHasOverflow(false); return; }
      checkOverflow();
      const el = scrollRef.current;
      if (!el) return;
      const ro = new ResizeObserver(checkOverflow);
      ro.observe(el);
      el.addEventListener('scroll', checkOverflow, { passive: true });
      return () => {
        ro.disconnect();
        el.removeEventListener('scroll', checkOverflow);
      };
    }, [checkOverflow, items, isFill]);

    /* ─── Scroll to active tab after add (triggered from handleAdd) ─── */

    const pendingScrollAfterAdd = useRef(false);

    const handleAdd = useCallback(() => {
      pendingScrollAfterAdd.current = true;
      onAdd?.();
      // Scroll after parent adds the tab and React re-renders
      requestAnimationFrame(() => {
        if (!pendingScrollAfterAdd.current) return;
        pendingScrollAfterAdd.current = false;
        const el = scrollRef.current?.querySelector(
          `[data-tab-value="${activeValue}"]`,
        ) as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }, [onAdd, activeValue]);

    /* ─── Scroll by one tab width ─── */

    const scrollBy = useCallback((dir: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      const tabs = Array.from(el.children).filter(
        (c) => c.getAttribute('role') === 'tab',
      ) as HTMLElement[];
      const containerRect = el.getBoundingClientRect();

      if (dir === 1) {
        const next = tabs.find(
          (t) => t.getBoundingClientRect().right > containerRect.right + 1,
        );
        if (next) {
          el.scrollLeft += next.getBoundingClientRect().left - containerRect.left;
        }
      } else {
        const prev = [...tabs]
          .reverse()
          .find((t) => t.getBoundingClientRect().left < containerRect.left - 1);
        if (prev) {
          el.scrollLeft -=
            containerRect.right - prev.getBoundingClientRect().right;
        }
      }
    }, []);

    /* ─── Tab click ─── */

    const handleTabClick = useCallback(
      (val: string) => {
        if (!isControlled) setInternalValue(val);
        onChange?.(val);
      },
      [isControlled, onChange],
    );

    /* ─── Kebab menu ─── */

    const toggleMenu = useCallback(() => {
      setMenuOpen((prev) => {
        if (!prev) setHighlightIndex(-1);
        return !prev;
      });
    }, []);

    // Scroll to selected item when dropdown mounts
    const scrollToSelected = useCallback(() => {
      const list = listRef.current;
      if (!list) return;
      const idx = items.findIndex((t) => t.value === activeValue);
      if (idx < 0) return;
      const item = list.children[idx] as HTMLElement | undefined;
      if (!item) return;
      const listPad = parseFloat(getComputedStyle(list).paddingTop) || 0;
      list.scrollTop = item.offsetTop - listPad;
    }, [items, activeValue]);

    // Scroll highlighted item into view
    const scrollToIndex = useRef<number | null>(null);
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

    /* ─── Menu keyboard nav ─── */

    const handleMenuKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!menuOpen) return;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightIndex((prev) => {
              for (let i = prev + 1; i < items.length; i++) {
                if (!items[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightIndex((prev) => {
              const start = prev < 0 ? items.length : prev;
              for (let i = start - 1; i >= 0; i--) {
                if (!items[i].disabled) { scrollToIndex.current = i; return i; }
              }
              return prev;
            });
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightIndex >= 0 && !items[highlightIndex]?.disabled) {
              handleTabClick(items[highlightIndex].value);
              setMenuOpen(false);
              const el = scrollRef.current?.querySelector(
                `[data-tab-value="${items[highlightIndex].value}"]`,
              ) as HTMLElement | null;
              el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
            break;
          case 'Escape':
            e.preventDefault();
            setMenuOpen(false);
            kebabRef.current?.focus();
            break;
          case 'Tab':
            setMenuOpen(false);
            break;
        }
      },
      [menuOpen, items, highlightIndex, handleTabClick],
    );

    /* ─── Tab keyboard nav ─── */

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const enabledItems = items.filter((t) => !t.disabled);
        const idx = enabledItems.findIndex((t) => t.value === activeValue);
        let next: TabItemData | undefined;

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          next = enabledItems[(idx + 1) % enabledItems.length];
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          next =
            enabledItems[(idx - 1 + enabledItems.length) % enabledItems.length];
        } else if (e.key === 'Home') {
          e.preventDefault();
          next = enabledItems[0];
        } else if (e.key === 'End') {
          e.preventDefault();
          next = enabledItems[enabledItems.length - 1];
        }

        if (next) {
          if (!isControlled) setInternalValue(next.value);
          onChange?.(next.value);
          const el = scrollRef.current?.querySelector(
            `[data-tab-value="${next.value}"]`,
          ) as HTMLElement | null;
          el?.focus();
        }
      },
      [items, activeValue, isControlled, onChange],
    );

    /* ─── Drag and drop ─── */

    const dragIndexRef = useRef<number | null>(null);
    const dropDataRef = useRef<{ toIndex: number } | null>(null);
    const [dropIndicatorLeft, setDropIndicatorLeft] = useState<number | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    /* Auto-scroll when dragging near edges */
    const dragMouseX = useRef<number>(0);
    const autoScrollRaf = useRef<number>(0);

    const startAutoScroll = useCallback(() => {
      cancelAnimationFrame(autoScrollRaf.current);
      const EDGE_ZONE = 40;
      const MAX_SPEED = 12;

      const tick = () => {
        const scroll = scrollRef.current;
        if (!scroll || dragIndexRef.current === null) return;
        const rect = scroll.getBoundingClientRect();
        const x = dragMouseX.current;

        const distFromLeft = x - rect.left;
        const distFromRight = rect.right - x;

        if (distFromLeft < EDGE_ZONE && distFromLeft >= 0) {
          scroll.scrollLeft -= MAX_SPEED * (1 - distFromLeft / EDGE_ZONE);
        } else if (distFromRight < EDGE_ZONE && distFromRight >= 0) {
          scroll.scrollLeft += MAX_SPEED * (1 - distFromRight / EDGE_ZONE);
        }

        autoScrollRaf.current = requestAnimationFrame(tick);
      };
      autoScrollRaf.current = requestAnimationFrame(tick);
    }, []);

    const stopAutoScroll = useCallback(() => {
      cancelAnimationFrame(autoScrollRaf.current);
    }, []);

    const computeDropPosition = useCallback(
      (clientX: number) => {
        const from = dragIndexRef.current;
        if (from === null) return;

        const scroll = scrollRef.current;
        if (!scroll) return;
        const scrollRect = scroll.getBoundingClientRect();
        const tabs = Array.from(scroll.querySelectorAll('[role="tab"]')) as HTMLElement[];
        if (tabs.length === 0) return;

        // Find insertion index based on cursor X vs tab midpoints
        let toIndex = tabs.length; // default: after last
        for (let i = 0; i < tabs.length; i++) {
          const rect = tabs[i].getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (clientX < midX) {
            toIndex = i;
            break;
          }
        }

        // No-op positions
        if (toIndex === from || toIndex === from + 1) {
          dropDataRef.current = null;
          setDropIndicatorLeft(null);
          return;
        }

        // Compute indicator pixel position
        let left: number;
        if (toIndex === 0) {
          const firstRect = tabs[0].getBoundingClientRect();
          left = firstRect.left - scrollRect.left + scroll.scrollLeft - 1;
        } else if (toIndex >= tabs.length) {
          const lastRect = tabs[tabs.length - 1].getBoundingClientRect();
          left = lastRect.right - scrollRect.left + scroll.scrollLeft + 1;
        } else {
          const prevRect = tabs[toIndex - 1].getBoundingClientRect();
          const nextRect = tabs[toIndex].getBoundingClientRect();
          const gapCenter = (prevRect.right + nextRect.left) / 2;
          left = gapCenter - scrollRect.left + scroll.scrollLeft - 1;
        }

        dropDataRef.current = { toIndex };
        setDropIndicatorLeft(left);
      },
      [],
    );

    /** Check if cursor Y is within the expanded vertical zone (1.5× tab height above/below) */
    const isInVerticalZone = useCallback((clientY: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return false;
      const rect = scroll.getBoundingClientRect();
      const margin = rect.height * 1.5;
      return clientY >= rect.top - margin && clientY <= rect.bottom + margin;
    }, []);

    const handleDragStart = useCallback(
      (index: number, e: React.DragEvent) => {
        if (items[index]?.disabled) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        dragIndexRef.current = index;
        dragMouseX.current = e.clientX;
        setIsDragActive(true);
        if (scrollRef.current) scrollRef.current.style.scrollBehavior = 'auto';
        startAutoScroll();
      },
      [items, startAutoScroll],
    );

    const cleanupDrag = useCallback(() => {
      dragIndexRef.current = null;
      dropDataRef.current = null;
      setDropIndicatorLeft(null);
      setIsDragActive(false);
      stopAutoScroll();
      if (scrollRef.current) scrollRef.current.style.scrollBehavior = '';
    }, [stopAutoScroll]);

    const handleDragEnd = useCallback(() => {
      cleanupDrag();
    }, [cleanupDrag]);

    /* Document-level drag listeners — active only during drag */
    const onReorderRef = useRef(onReorder);
    onReorderRef.current = onReorder;

    useEffect(() => {
      if (!isDragActive) return;

      const handleDocDragOver = (e: DragEvent) => {
        if (dragIndexRef.current === null) return;
        dragMouseX.current = e.clientX;

        if (isInVerticalZone(e.clientY)) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          computeDropPosition(e.clientX);
        } else {
          // Outside vertical zone — clear indicator
          dropDataRef.current = null;
          setDropIndicatorLeft(null);
        }
      };

      const handleDocDrop = (e: DragEvent) => {
        if (dragIndexRef.current === null) return;
        e.preventDefault();
        const from = dragIndexRef.current;
        const data = dropDataRef.current;
        if (from !== null && data) {
          let to = data.toIndex;
          if (to > from) to -= 1;
          if (from !== to) onReorderRef.current?.(from, to);
        }
        cleanupDrag();
      };

      document.addEventListener('dragover', handleDocDragOver);
      document.addEventListener('drop', handleDocDrop);
      return () => {
        document.removeEventListener('dragover', handleDocDragOver);
        document.removeEventListener('drop', handleDocDrop);
      };
    }, [isDragActive, isInVerticalZone, computeDropPosition, cleanupDrag]);

    /* ─── Render ─── */

    const containerCls = [
      s.container,
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      isUnderline && s.underline,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const scrollCls = [
      s.scrollArea,
      isFill && s.fillLayout,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={containerCls} role="tablist" {...rest}>
        {/* Left arrow + divider */}
        {showArrows && !isFill && (
          <>
            <Button
              kind="icon"
              icon={ArrowLeft01Icon}
              buttonType="tertiary"
              status="neutral"
              padSize={padSize}
              textSize={textSize}
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll tabs left"
              tabIndex={-1}
            />
            <span className={s.divider} />
          </>
        )}

        {/* Scrollable tab area */}
        <div
          ref={scrollRef}
          className={scrollCls}
          onKeyDown={handleKeyDown}
        >
          {items.map((item, i) => (
            <TabItem
              key={item.value}
              value={item.value}
              label={item.label}
              icon={item.icon}
              active={item.value === activeValue}
              closable={closableAll || item.closable}
              disabled={item.disabled}
              variant={variant}
              fill={isFill}
              tabIndex={item.value === activeValue ? 0 : -1}
              onClick={handleTabClick}
              onClose={onClose}
              isDraggable={draggableProp}
              isDragging={draggableProp && dragIndexRef.current === i && dropIndicatorLeft !== null}
              onDragStart={draggableProp ? (e) => handleDragStart(i, e) : undefined}
              onDragEnd={draggableProp ? handleDragEnd : undefined}
            />
          ))}
          {isUnderline && indicatorStyle && (
            <span className={s.indicator} style={indicatorStyle} />
          )}
          {draggableProp && dropIndicatorLeft !== null && (
            <span
              className={s.dropIndicator}
              style={{ transform: `translateX(${dropIndicatorLeft}px)` }}
            />
          )}
        </div>

        {/* Divider + Right arrow */}
        {showArrows && !isFill && (
          <>
            <span className={s.divider} />
            <Button
              kind="icon"
              icon={ArrowRight01Icon}
              buttonType="tertiary"
              status="neutral"
              padSize={padSize}
              textSize={textSize}
              disabled={!canScrollRight}
              onClick={() => scrollBy(1)}
              aria-label="Scroll tabs right"
              tabIndex={-1}
            />
          </>
        )}

        {/* Kebab */}
        {showKebab && (
          <Button
            ref={kebabRef}
            kind="icon"
            icon={MoreVerticalIcon}
            buttonType="tertiary"
            status="neutral"
            padSize={padSize}
            textSize={textSize}
            pressed={menuOpen}
            onClick={toggleMenu}
            aria-label="Show all tabs"
            aria-expanded={menuOpen}
            tabIndex={-1}
          />
        )}

        {/* Add button */}
        {onAdd && (
          <>
            {(showArrows || showKebab || items.length > 0) && <span className={s.divider} />}
            <Button
              kind="icon"
              icon={Add01Icon}
              buttonType="tertiary"
              status="neutral"
              padSize={padSize}
              textSize={textSize}
              onClick={handleAdd}
              aria-label={addLabel}
              tabIndex={-1}
            />
          </>
        )}

        <Dropdown
          ref={menuRef}
          anchorRef={kebabRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          itemHeight={MENU_ITEM_HEIGHT[padSize]}
          maxVisible={MAX_VISIBLE}
          align="end"
          minWidth={200}
          scrollRef={listRef}
          onMount={scrollToSelected}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, i) => (
            <MenuItem
              key={item.value}
              padSize={padSize}
              textSize={textSize}
              selected={item.value === activeValue}
              disabled={item.disabled}
              className={i === highlightIndex ? s.optionHighlighted : undefined}
              onMouseEnter={() => !item.disabled && setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!item.disabled) {
                  handleTabClick(item.value);
                  setMenuOpen(false);
                  const el = scrollRef.current?.querySelector(
                    `[data-tab-value="${item.value}"]`,
                  ) as HTMLElement | null;
                  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Dropdown>
      </div>
    );
  },
);

TabGroup.displayName = 'TabGroup';
