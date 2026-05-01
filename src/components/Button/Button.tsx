import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useState, useCallback, useRef } from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { ChevronDownIcon } from './ChevronDownIcon';
import styles from './Button.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type ButtonKind = 'text' | 'icon' | 'split';
export type ButtonType = 'primary' | 'secondary' | 'tertiary';
export type ButtonStatus = 'brand' | 'neutral' | 'error';

interface ButtonBaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  buttonType?: ButtonType;
  status?: ButtonStatus;
  padSize?: PadSize;
  textSize?: TextSize;
  toggleable?: boolean;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

export interface TextButtonProps extends ButtonBaseProps {
  kind?: 'text';
  iconLeft?: IconSvgElement;
  iconRight?: IconSvgElement;
  showIconLeft?: boolean;
  showIconRight?: boolean;
  children: ReactNode;
}

export interface IconButtonProps extends ButtonBaseProps {
  kind: 'icon';
  icon: IconSvgElement;
  'aria-label': string;
  children?: never;
}

export interface SplitButtonProps extends ButtonBaseProps {
  kind: 'split';
  icon?: IconSvgElement;
  children?: ReactNode;
  onDropdownClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  dropdownAriaLabel?: string;
}

export type ButtonProps = TextButtonProps | IconButtonProps | SplitButtonProps;


export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      buttonType = 'primary',
      status = 'brand',
      padSize: padSizeProp,
      textSize: textSizeProp,
      toggleable = false,
      pressed: pressedProp,
      defaultPressed = false,
      onPressedChange,
      className,
      kind = 'text',
      onClick,
      ...rest
    } = props;

    const padSize = padSizeProp ?? 'md';
    const textSize = textSizeProp ?? 14;

    const [internalPressed, setInternalPressed] = useState(defaultPressed);
    const isControlled = pressedProp !== undefined;
    const isTogglePressed = toggleable && (isControlled ? pressedProp : internalPressed);
    // Visual pressed state: toggleable changes type/status, non-toggleable adds .pressed CSS class
    const isVisualPressed = !toggleable && pressedProp;

    const onPressedChangeRef = useRef(onPressedChange);
    onPressedChangeRef.current = onPressedChange;
    const onClickRef = useRef(onClick);
    onClickRef.current = onClick;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (toggleable) {
          const next = !isTogglePressed;
          if (!isControlled) setInternalPressed(next);
          onPressedChangeRef.current?.(next);
        }
        onClickRef.current?.(e);
      },
      [toggleable, isTogglePressed, isControlled],
    );

    // Toggle overrides: neutral/tertiary → brand/secondary when pressed
    const resolvedType = isTogglePressed ? 'secondary' : buttonType;
    const resolvedStatus = isTogglePressed ? 'brand' : status;

    const baseCls = [
      styles.button,
      styles[resolvedType],
      styles[resolvedStatus],
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      isVisualPressed && styles.pressed,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const toggleProps = toggleable ? { 'aria-pressed': isTogglePressed } as const : {};

    // Icon-only button
    if (kind === 'icon') {
      const { icon, 'aria-label': ariaLabel, ...btnProps } = rest as Omit<IconButtonProps, 'kind' | 'buttonType' | 'status' | 'size' | 'padSize' | 'textSize' | 'className'>;
      return (
        <TextSizeProvider size={textSize}>
          <button ref={ref} className={baseCls} aria-label={ariaLabel} onClick={handleClick} {...toggleProps} {...btnProps}>
            <IconBox icon={icon} />
          </button>
        </TextSizeProvider>
      );
    }

    // Split button
    if (kind === 'split') {
      const { icon, children, onDropdownClick, dropdownAriaLabel, ...btnProps } = rest as Omit<SplitButtonProps, 'kind' | 'buttonType' | 'status' | 'size' | 'padSize' | 'textSize' | 'className'>;
      const mainCls = [baseCls, styles.splitMain].filter(Boolean).join(' ');
      const dropCls = [
        styles.button,
        styles[resolvedType],
        styles[resolvedStatus],
        PAD_CLASS[padSize],
        TEXT_CLASS[textSize],
        styles.splitDropdown,
      ]
        .filter(Boolean)
        .join(' ');

      const groupCls = [
        styles.splitGroup,
        resolvedType === 'tertiary' && styles.splitTertiary,
        resolvedType === 'secondary' && styles.splitSecondary,
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <TextSizeProvider size={textSize}>
          <div className={groupCls}>
            <button ref={ref} className={mainCls} onClick={handleClick} {...toggleProps} {...btnProps}>
              {icon && (
                <IconBox icon={icon} />
              )}
              {children && <span className={styles.label}>{children}</span>}
            </button>
            <button
              type="button"
              className={dropCls}
              onClick={onDropdownClick}
              aria-label={dropdownAriaLabel ?? 'Toggle dropdown'}
            >
              <ChevronDownIcon />
            </button>
          </div>
        </TextSizeProvider>
      );
    }

    // Text button (default)
    const { iconLeft, iconRight, showIconLeft = true, showIconRight = true, children, ...btnProps } = rest as Omit<TextButtonProps, 'kind' | 'buttonType' | 'status' | 'size' | 'padSize' | 'textSize' | 'className'>;
    return (
      <TextSizeProvider size={textSize}>
        <button ref={ref} className={baseCls} onClick={handleClick} {...toggleProps} {...btnProps}>
          {iconLeft && showIconLeft && (
            <IconBox icon={iconLeft} />
          )}
          <span className={styles.label}>{children}</span>
          {iconRight && showIconRight && (
            <IconBox icon={iconRight} />
          )}
        </button>
      </TextSizeProvider>
    );
  },
);

Button.displayName = 'Button';
