import {
  forwardRef,
  Children,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import s from './Toast.module.css';
import { Button } from '../Button/Button';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastLayout = 'stack' | 'group';

export interface ToastContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Screen position */
  position?: ToastPosition;
  /** Layout mode: stack (vertical list) or group (Apple-style pile) */
  layout?: ToastLayout;
  /** Whether the group is expanded (only applies to layout="group") */
  expanded?: boolean;
  /** Callback when the expand/collapse toggle is clicked (group layout only) */
  onToggle?: () => void;
  /** Toast elements */
  children?: ReactNode;
}

export const ToastContainer = forwardRef<HTMLDivElement, ToastContainerProps>(
  (
    {
      position = 'top-right',
      layout = 'stack',
      expanded = false,
      onToggle,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const posMap: Record<ToastPosition, string> = {
      'top-left': s.topleft,
      'top-center': s.topcenter,
      'top-right': s.topright,
      'bottom-left': s.bottomleft,
      'bottom-center': s.bottomcenter,
      'bottom-right': s.bottomright,
    };

    const cls = [
      s.container,
      posMap[position],
      layout === 'stack' ? s.stack : s.group,
      layout === 'group' && expanded && s.groupExpanded,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const count = Children.count(children);
    const hasToggle = layout === 'group' && onToggle;
    const showToggle = hasToggle && count > 1;

    const el = (
      <div ref={ref} className={cls} {...rest}>
        <div className={s.toastList} aria-live="polite" aria-relevant="additions">
          {Children.map(children, (child) => (
            <div className={s.toastSlot}>{child}</div>
          ))}
        </div>
        {hasToggle && (
          <div className={`${s.toggleSlot}${showToggle ? ` ${s.toggleVisible}` : ''}`}>
            <Button
              kind="text"
              buttonType="secondary"
              status="neutral"
              padSize="sm"
              textSize={12}
              className={s.toggleBtn}
              onClick={onToggle}
              aria-label={expanded ? 'Collapse notifications' : 'Expand notifications'}
              tabIndex={showToggle ? 0 : -1}
            >
              {expanded ? 'Collapse' : `${count} notifications`}
            </Button>
          </div>
        )}
      </div>
    );

    return createPortal(el, document.body);
  },
);

ToastContainer.displayName = 'ToastContainer';
