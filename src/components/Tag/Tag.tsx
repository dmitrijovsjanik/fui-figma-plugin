import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './Tag.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type TagVariant = 'filled' | 'outlined' | 'ghost' | 'inline';
export type TagStatus = 'brand' | 'neutral' | 'danger' | 'success' | 'warning';
export type TagPadSize = PadSize | 'xs';

/** Pad class for Tag — extends global PAD_CLASS with xs */
const TAG_PAD_CLASS: Record<TagPadSize, string> = { ...PAD_CLASS, xs: 'fui-pad-xs' };

export type TagProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  variant?: TagVariant;
  status?: TagStatus;
  padSize?: TagPadSize;
  textSize?: TextSize;
  disabled?: boolean;

  /** Left slot — defaults to IconBox when `icon` is provided */
  icon?: IconSvgElement;
  /** Override the left slot entirely */
  slotLeft?: ReactNode;

  /** Show close button on the right */
  closable?: boolean;
  onClose?: () => void;

  /** Selectable mode (when not closable) */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;

  children: ReactNode;
};

export const Tag = forwardRef<HTMLDivElement, TagProps>(
  (
    {
      variant = 'filled',
      status = 'neutral',
      padSize = 'sm',
      textSize = 12,
      disabled = false,
      icon,
      slotLeft,
      closable = false,
      onClose,
      selectable = false,
      selected = false,
      onSelectedChange,
      children,
      className,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const isSelectable = selectable && !closable;

    const cls = [
      s.tag,
      s[variant],
      s[status],
      variant !== 'inline' && TAG_PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      isSelectable && s.selectable,
      isSelectable && selected && s.selected,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isSelectable && !disabled) {
        onSelectedChange?.(!selected);
      }
      onClick?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isSelectable && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        onSelectedChange?.(!selected);
      }
      rest.onKeyDown?.(e);
    };

    const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClose?.();
    };

    const leftContent = slotLeft ?? (icon ? <IconBox icon={icon} /> : null);

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={ref}
          role={isSelectable ? 'option' : undefined}
          aria-selected={isSelectable ? selected : undefined}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          className={cls}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {leftContent}
          <span className={s.label}>{children}</span>
          {closable && (
            <IconBox
              icon={Cancel01Icon}
              behavior="highlight"
              className={s.close}
              onClick={handleClose}
              aria-label="Remove"
              tabIndex={-1}
              disabled={disabled}
            />
          )}
        </div>
      </TextSizeProvider>
    );
  },
);

Tag.displayName = 'Tag';
