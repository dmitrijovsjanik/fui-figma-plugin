import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  InformationCircleIcon,
  AlertDiamondIcon,
} from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './Notification.module.css';
import {
  type PadSize,
  type TextSize,
  PAD_CLASS,
  TEXT_CLASS,
} from '../../tokens/size';


export type NotificationStatus = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const STATUS_ICON: Record<Exclude<NotificationStatus, 'neutral'>, IconSvgElement> = {
  success: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  danger: AlertDiamondIcon,
  info: InformationCircleIcon,
};

export interface NotificationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual status */
  status?: NotificationStatus;
  /** Padding density */
  padSize?: PadSize;
  /** Text / icon sizing */
  textSize?: TextSize;
  /** Text size override for subtitle zone (inherits textSize if omitted) */
  subtitleTextSize?: TextSize;
  /** Title text (required) */
  title: ReactNode;
  /** Subtitle / description text */
  subtitle?: ReactNode;
  /** Custom status icon override (only for non-neutral) */
  icon?: IconSvgElement;
  /** Show close button */
  closable?: boolean;
  /** Close button callback */
  onClose?: () => void;
  /** Slot for extra content below subtitle (buttons, form fields, etc.) */
  children?: ReactNode;
}

export const Notification = forwardRef<HTMLDivElement, NotificationProps>(
  (
    {
      status = 'neutral',
      padSize: padSizeProp,
      textSize: textSizeProp,
      subtitleTextSize,
      title,
      subtitle,
      icon,
      closable = false,
      onClose,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const padSize = padSizeProp ?? 'md';
    const textSize = textSizeProp ?? 14;

    const isStatus = status !== 'neutral';
    const statusIcon = icon ?? (isStatus ? STATUS_ICON[status] : undefined);

    const cls = [
      s.notification,
      s[status],
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <TextSizeProvider size={textSize}>
        <div ref={ref} role="alert" className={cls} {...rest}>
          {statusIcon && (
            <IconBox icon={statusIcon} className={s.statusIcon} />
          )}

          <div className={s.body}>
            <div className={s.title}>{title}</div>
            {subtitle && <div className={[s.subtitle, subtitleTextSize && TEXT_CLASS[subtitleTextSize]].filter(Boolean).join(' ')}>{subtitle}</div>}
            {children && <div className={s.content}>{children}</div>}
          </div>

          {closable && (
            <IconBox
              icon={Cancel01Icon}
              behavior="ghost"
              className={s.closeBtn}
              onClick={onClose}
              aria-label="Close notification"
            />
          )}
        </div>
      </TextSizeProvider>
    );
  },
);

Notification.displayName = 'Notification';
