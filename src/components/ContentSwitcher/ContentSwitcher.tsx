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
import s from './ContentSwitcher.module.css';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import {
  type PadSize,
  type TextSize,
  PAD_CLASS,
  TEXT_CLASS,
} from '../../tokens/size';

/* ─── Types ─── */

export interface ContentSwitchItem {
  /** Unique value identifying this switch */
  value: string;
  /** Label displayed in the switch */
  label?: ReactNode;
  /** Icon displayed before (or instead of) the label */
  icon?: IconSvgElement;
  /** Disabled state */
  disabled?: boolean;
}

export type ContentSwitcherLayout = 'auto' | 'equal' | 'fill';

export type ContentSwitcherProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> & {
  /** Switch definitions */
  items: ContentSwitchItem[];
  /** Padding density */
  padSize?: PadSize;
  /** Text / icon sizing */
  textSize?: TextSize;
  /** Controlled active switch value */
  value?: string;
  /** Default active switch value (uncontrolled) */
  defaultValue?: string;
  /** Called when active switch changes */
  onChange?: (value: string) => void;
  /**
   * Layout mode:
   * - `auto` — each item sized by its content, container wraps (default)
   * - `equal` — all items same width (longest item), container wraps
   * - `fill` — container fills parent width, items stretch equally
   */
  layout?: ContentSwitcherLayout;
};

/* ─── Component ─── */

export const ContentSwitcher = forwardRef<HTMLDivElement, ContentSwitcherProps>(
  (
    {
      items,
      padSize = 'lg',
      textSize = 16,
      value: valueProp,
      defaultValue,
      onChange,
      layout = 'auto',
      className,
      ...rest
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(
      defaultValue ?? items[0]?.value ?? '',
    );
    const isControlled = valueProp !== undefined;
    const activeValue = isControlled ? valueProp : internalValue;

    const containerRef = useRef<HTMLDivElement>(null);

    /* ─── Sliding indicator ─── */

    const [indicatorStyle, setIndicatorStyle] = useState<{
      width: number;
      transform: string;
    } | null>(null);

    const syncIndicator = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const activeEl = container.querySelector(
        `[data-switch-value="${activeValue}"]`,
      ) as HTMLElement | null;
      if (!activeEl) {
        setIndicatorStyle(null);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const left = activeRect.left - containerRect.left;
      const width = activeRect.width;
      setIndicatorStyle({ width, transform: `translateX(${left}px)` });
    }, [activeValue]);

    useEffect(() => {
      syncIndicator();
    }, [syncIndicator]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncIndicator);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncIndicator]);

    /* ─── Click handler ─── */

    const handleClick = useCallback(
      (val: string) => {
        if (!isControlled) setInternalValue(val);
        onChange?.(val);
      },
      [isControlled, onChange],
    );

    /* ─── Keyboard navigation (roving tabindex) ─── */

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const enabledItems = items.filter((item) => !item.disabled);
        const idx = enabledItems.findIndex((item) => item.value === activeValue);
        let next: ContentSwitchItem | undefined;

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          next = enabledItems[(idx + 1) % enabledItems.length];
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          next =
            enabledItems[
              (idx - 1 + enabledItems.length) % enabledItems.length
            ];
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
          const el = containerRef.current?.querySelector(
            `[data-switch-value="${next.value}"]`,
          ) as HTMLElement | null;
          el?.focus();
        }
      },
      [items, activeValue, isControlled, onChange],
    );

    /* ─── Binary toggle: click anywhere on container ─── */

    const isBinary = items.length === 2;

    const handleContainerClick = useCallback(
      () => {
        if (!isBinary) return;
        const enabledItems = items.filter((item) => !item.disabled);
        if (enabledItems.length !== 2) return;
        const next = enabledItems.find((item) => item.value !== activeValue);
        if (next) {
          if (!isControlled) setInternalValue(next.value);
          onChange?.(next.value);
        }
      },
      [isBinary, items, activeValue, isControlled, onChange],
    );

    /* ─── Render ─── */

    const containerCls = [
      s.container,
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      layout === 'fill' && s.fill,
      layout === 'equal' && s.equal,
      isBinary && s.binary,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={containerCls}
          role="tablist"
          onKeyDown={handleKeyDown}
          onClick={isBinary ? handleContainerClick : undefined}
          {...rest}
        >
          {indicatorStyle && (
            <span
              className={s.indicator}
              style={indicatorStyle}
            />
          )}
          {items.map((item) => {
            const isActive = item.value === activeValue;
            const isIconOnly = !!item.icon && !item.label;

            const btnCls = [
              s.switch,
              isActive && s.active,
              item.disabled && s.disabled,
              isIconOnly && s.iconOnly,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                data-switch-value={item.value}
                className={btnCls}
                aria-selected={isActive}
                aria-disabled={item.disabled || undefined}
                aria-label={isIconOnly && typeof item.label !== 'string' ? item.value : undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={item.disabled || isBinary ? undefined : () => handleClick(item.value)}
              >
                {item.icon && <IconBox icon={item.icon} />}
                {item.label && <span className={s.label}>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </TextSizeProvider>
    );
  },
);

ContentSwitcher.displayName = 'ContentSwitcher';
