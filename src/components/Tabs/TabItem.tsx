import { forwardRef, type ReactNode, type DragEvent } from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { IconBox } from '../Icon/IconBox';
import s from './Tabs.module.css';
import type { TabsVariant } from './TabGroup';

export interface TabItemProps {
  value: string;
  label: ReactNode;
  /** Icon displayed before the label */
  icon?: IconSvgElement;
  active?: boolean;
  closable?: boolean;
  disabled?: boolean;
  variant?: TabsVariant;
  fill?: boolean;
  tabIndex?: number;
  onClick?: (value: string) => void;
  onClose?: (value: string) => void;
  /** Enable HTML5 draggable (only works when icon is set — drag starts from icon) */
  isDraggable?: boolean;
  /** Tab is currently being dragged */
  isDragging?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
}

export const TabItem = forwardRef<HTMLButtonElement, TabItemProps>(
  (
    {
      value,
      label,
      icon,
      active = false,
      closable = false,
      disabled = false,
      fill = false,
      tabIndex = -1,
      onClick,
      onClose,
      isDraggable = false,
      isDragging = false,
      onDragStart,
      onDragEnd,
    },
    ref,
  ) => {
    const canDrag = isDraggable && !!icon && !disabled;

    const cls = [
      s.tab,
      active && s.active,
      disabled && s.disabled,
      fill && s.tabFill,
      isDragging && s.tabDragging,
    ]
      .filter(Boolean)
      .join(' ');

    const handleHandleDragStart = (e: DragEvent) => {
      // Use the whole tab button as the drag ghost
      const tab = (e.target as HTMLElement).closest('[role="tab"]') as HTMLElement | null;
      if (tab) {
        const rect = tab.getBoundingClientRect();
        e.dataTransfer.setDragImage(tab, e.clientX - rect.left, e.clientY - rect.top);
      }
      onDragStart?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        data-tab-value={value}
        className={cls}
        aria-selected={active}
        aria-disabled={disabled || undefined}
        tabIndex={tabIndex}
        onClick={disabled ? undefined : () => onClick?.(value)}
      >
        {icon && (
          <span
            className={s.dragHandle}
            draggable={canDrag || undefined}
            onDragStart={canDrag ? handleHandleDragStart : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
          >
            <IconBox icon={icon} />
          </span>
        )}
        <span className={s.label}>{label}</span>
        {closable && (
          <IconBox
            icon={Cancel01Icon}
            behavior="highlight"
            className={s.closeBtn}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onClose?.(value);
            }}
            onDragStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            aria-label={`Close ${typeof label === 'string' ? label : 'tab'}`}
            tabIndex={-1}
          />
        )}
      </button>
    );
  },
);

TabItem.displayName = 'TabItem';
