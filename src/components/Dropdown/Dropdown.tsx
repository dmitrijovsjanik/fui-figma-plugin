import {
  forwardRef,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import s from './Dropdown.module.css';

export type DropdownVariant = 'default' | 'dense';

export type DropdownPlacement = 'bottom' | 'right';

export interface DropdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Visual variant: 'default' has padding/gaps/rounded items, 'dense' has none */
  variant?: DropdownVariant;
  /** Placement relative to anchor: 'bottom' (default) or 'right' (for submenus) */
  placement?: DropdownPlacement;
  /** The element the dropdown is anchored to */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Whether the dropdown is open */
  open: boolean;
  /** Called when the dropdown should close (outside click) */
  onClose?: () => void;
  /** Item height in px (for max-height calculation) */
  itemHeight: number;
  /** Maximum visible items before scrolling */
  maxVisible?: number;
  /** Horizontal alignment relative to anchor */
  align?: 'start' | 'end';
  /** Minimum width in px */
  minWidth?: number;
  /** Match anchor width. true = exact match, number = px to add (e.g. 8 → width + 8) */
  matchWidth?: boolean | number;
  /** Horizontal offset applied to left position (e.g. -4 to shift left) */
  offsetX?: number;
  /** Ref to the inner scroll container (for scroll-to-item) */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * Extra refs to consider "inside" for outside-click detection.
   * Clicks on these elements won't trigger onClose.
   */
  outsideRefs?: React.RefObject<HTMLElement | null>[];
  /** Extra HTML attributes applied to the inner scroll container (e.g. id, role) */
  scrollProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Called once when the dropdown portal mounts and the scroll container is available */
  onMount?: () => void;
  /** Children rendered inside the scroll area */
  children: ReactNode;
}

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      variant = 'default',
      placement = 'bottom',
      anchorRef,
      open,
      onClose,
      itemHeight,
      maxVisible = 6,
      align = 'start',
      minWidth,
      matchWidth = false,
      offsetX = 0,
      scrollRef: scrollRefProp,
      outsideRefs,
      scrollProps,
      onMount,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const internalListRef = useRef<HTMLDivElement>(null);
    const listRef = scrollRefProp ?? internalListRef;

    const [pos, setPos] = useState<{
      top: number;
      left: number;
      width?: number;
      maxHeight: number;
    } | null>(null);
    const posRef = useRef(pos);
    posRef.current = pos;

    const [overflows, setOverflows] = useState(false);
    const [scrollMaxH, setScrollMaxH] = useState<number | null>(null);

    const isDense = variant === 'dense';
    const itemGap = isDense ? 0 : 2;
    const spacer = isDense ? 0 : 4 - itemGap; // ::before and ::after height
    const shellPad = spacer * 2 + itemGap * 2; // top spacer + gap + gap + bottom spacer

    const calcScrollMax = useCallback((count: number) => {
      // ≤ maxVisible items → no height limit (hug content)
      if (count <= maxVisible) return Infinity;
      // > maxVisible → cap at maxVisible - 0.5 to hint there's more
      const vis = maxVisible - 0.5;
      return vis * itemHeight
        + Math.max(0, Math.floor(vis) - 1) * itemGap
        + shellPad;
    }, [maxVisible, itemHeight, itemGap, shellPad]);

    // Fallback for positioning before mount
    const fallbackScrollMaxH = calcScrollMax(maxVisible);

    // rAF position sync loop
    useEffect(() => {
      if (!open) { setPos(null); return; }
      let raf: number;

      const sync = () => {
        const anchor = anchorRef.current;
        const list = listRef.current;
        if (!anchor) { raf = requestAnimationFrame(sync); return; }

        const rect = anchor.getBoundingClientRect();
        const anchorGap = 4;

        let width: number | undefined;
        if (matchWidth === true) {
          width = rect.width;
        } else if (typeof matchWidth === 'number') {
          width = rect.width + matchWidth;
        }

        const dropWidth = width ?? minWidth ?? 200;

        let top: number;
        let left: number;
        let maxHeight: number;

        if (placement === 'right') {
          // Use the parent dropdown container edge (not the individual item)
          const parentDrop = anchor.closest(`.${s.dropdown}`);
          const edgeRect = parentDrop ? parentDrop.getBoundingClientRect() : rect;
          const spaceRight = window.innerWidth - edgeRect.right - anchorGap;
          const spaceLeft = edgeRect.left - anchorGap;
          const flippedH = dropWidth > spaceRight && spaceLeft > spaceRight;
          left = flippedH
            ? edgeRect.left - anchorGap - dropWidth
            : edgeRect.right + anchorGap;
          top = rect.top;
          maxHeight = window.innerHeight - rect.top;
        } else {
          const spaceBelow = window.innerHeight - rect.bottom - anchorGap;
          const spaceAbove = rect.top - anchorGap;
          const effectiveMax = scrollMaxH ?? fallbackScrollMaxH;
          const naturalScrollH = list ? list.scrollHeight : effectiveMax;
          const visualH = Math.min(naturalScrollH, effectiveMax);
          const flipped = visualH > spaceBelow && spaceAbove > spaceBelow;
          const availableSpace = flipped ? spaceAbove : spaceBelow;

          if (align === 'end') {
            left = rect.right - dropWidth;
          } else {
            left = rect.left + offsetX;
          }
          top = flipped
            ? rect.top - anchorGap - Math.min(visualH, availableSpace)
            : rect.bottom + anchorGap;
          maxHeight = availableSpace;
        }

        const next = { top, left, width, maxHeight };

        const prev = posRef.current;
        if (
          !prev ||
          prev.top !== next.top ||
          prev.left !== next.left ||
          prev.width !== next.width ||
          prev.maxHeight !== next.maxHeight
        ) {
          setPos(next);
        }

        raf = requestAnimationFrame(sync);
      };
      raf = requestAnimationFrame(sync);
      return () => cancelAnimationFrame(raf);
    }, [open, anchorRef, scrollMaxH, fallbackScrollMaxH, align, minWidth, matchWidth, offsetX, placement, listRef]);

    // Close on outside click
    const handleOutsideClick = useCallback(
      (e: MouseEvent) => {
        const target = e.target as Node;
        if (menuRef.current && !menuRef.current.contains(target)) {
          // Check anchor
          if (anchorRef.current?.contains(target)) return;
          // Check extra refs
          if (outsideRefs?.some((r) => r.current?.contains(target))) return;
          onClose?.();
        }
      },
      [anchorRef, outsideRefs, onClose],
    );

    useEffect(() => {
      if (!open) return;
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open, handleOutsideClick]);

    // Notify consumer when portal mounts (pos transitions from null → value)
    const onMountRef = useRef(onMount);
    onMountRef.current = onMount;
    const didMount = useRef(false);
    useEffect(() => {
      if (open && pos) {
        if (!didMount.current) {
          didMount.current = true;
          // Wait one frame so scroll container has layout
          requestAnimationFrame(() => onMountRef.current?.());
        }
      } else {
        didMount.current = false;
      }
    }, [open, pos]);

    // Count menu items and detect overflow
    useEffect(() => {
      if (!open || !pos) { setOverflows(false); setScrollMaxH(null); return; }
      const el = listRef.current;
      if (!el) return;
      requestAnimationFrame(() => {
        const itemCount = el.querySelectorAll('[role="menuitem"]').length;
        const computed = calcScrollMax(itemCount);
        setScrollMaxH(computed);
        setOverflows(el.scrollHeight > computed);
      });
    }, [open, pos, listRef, calcScrollMax]);

    if (!open || !pos) return null;

    const effectiveScrollMax = scrollMaxH ?? fallbackScrollMaxH;
    const cls = [s.dropdown, variant === 'dense' && s.dense, overflows && s.overflows, className].filter(Boolean).join(' ');

    return createPortal(
      <div
        ref={(node) => {
          (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cls}
        style={{
          '--fui-dropdown-item-half-h': `${itemHeight / 2}px`,
          '--fui-dropdown-scroll-max': effectiveScrollMax === Infinity ? 'none' : `${effectiveScrollMax}px`,
          maxHeight: pos.maxHeight,
          top: pos.top,
          left: pos.left,
          width: pos.width,
          minWidth: minWidth,
        } as React.CSSProperties}
        {...rest}
      >
        <div ref={listRef} className={s.scroll} {...scrollProps}>
          {children}
        </div>
      </div>,
      document.body,
    );
  },
);

Dropdown.displayName = 'Dropdown';
