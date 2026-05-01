import {
  forwardRef,
  useState,
  useCallback,
  useRef,
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
import s from './Toast.module.css';
import {
  type PadSize,
  type TextSize,
  PAD_CLASS,
  TEXT_CLASS,
} from '../../tokens/size';


export type ToastStatus = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const STATUS_ICON: Record<Exclude<ToastStatus, 'neutral'>, IconSvgElement> = {
  success: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  danger: AlertDiamondIcon,
  info: InformationCircleIcon,
};

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual status */
  status?: ToastStatus;
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
  /** Custom status icon override */
  icon?: IconSvgElement;
  /** Timestamp string displayed in the header */
  timestamp?: string;
  /** Show close button */
  closable?: boolean;
  /** Close button callback — called after exit animation finishes */
  onClose?: () => void;
  /** Slot for extra content below subtitle */
  children?: ReactNode;
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      status = 'neutral',
      padSize: padSizeProp,
      textSize: textSizeProp,
      subtitleTextSize,
      title,
      subtitle,
      icon,
      timestamp,
      closable = true,
      onClose,
      children,
      className,
      onAnimationEnd: onAnimationEndProp,
      ...rest
    },
    ref,
  ) => {
    const padSize = padSizeProp ?? 'md';
    const textSize = textSizeProp ?? 14;

    const [closing, setClosing] = useState(false);
    const [entered, setEntered] = useState(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const isStatus = status !== 'neutral';
    const statusIcon = icon ?? (isStatus ? STATUS_ICON[status] : undefined);

    const cls = [
      s.toast,
      s[status],
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      entered && !closing && s.entered,
      closing && s.closing,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const handleClose = useCallback(() => {
      setClosing(true);
    }, []);

    const handleAnimationEnd = useCallback(
      (e: React.AnimationEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;

        if (closing) {
          onCloseRef.current?.();
          return;
        }
        // Mark as entered so CSS class stops entrance animation (allows transitions for repositioning)
        setEntered(true);
        onAnimationEndProp?.(e);
      },
      [closing, onAnimationEndProp],
    );

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={ref}
          role="alert"
          aria-live="assertive"
          className={cls}
          onAnimationEnd={handleAnimationEnd}
          {...rest}
        >
          {statusIcon && (
            <IconBox icon={statusIcon} className={s.statusIcon} />
          )}

          <div className={s.body}>
            <div className={s.title}>{title}</div>
            {subtitle && <div className={[s.subtitle, subtitleTextSize && TEXT_CLASS[subtitleTextSize]].filter(Boolean).join(' ')}>{subtitle}</div>}
            {timestamp && <span className={s.timestamp}>{timestamp}</span>}
            {children && <div className={s.content}>{children}</div>}
          </div>

          {closable && (
            <IconBox
              icon={Cancel01Icon}
              behavior="ghost"
              className={s.closeBtn}
              onClick={handleClose}
              aria-label="Close notification"
            />
          )}
        </div>
      </TextSizeProvider>
    );
  },
);

Toast.displayName = 'Toast';
