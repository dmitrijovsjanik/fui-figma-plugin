import {
  forwardRef,
  useState,
  useCallback,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { type IconSvgElement } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import { Checkbox, type CheckboxSize } from '../Selector/Checkbox';
import { Radio } from '../Selector/Radio';
import { Switcher } from '../Selector/Switcher';
import selectorStyles from '../Selector/Selector.module.css';
import s from './MenuItem.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

export type MenuItemSelector = 'checkbox' | 'radio';

export type MenuItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  padSize?: PadSize;
  textSize?: TextSize;
  /** Shows check icon on the right (visual only, not related to selector/toggle) */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Icon displayed on the left side (or top in vertical layout) */
  iconLeft?: IconSvgElement;
  /** Custom element for the left slot (e.g. Avatar). Takes priority over iconLeft. */
  leadSlot?: ReactNode;
  /** Show the left icon slot */
  showIconLeft?: boolean;
  /** Show a selector (checkbox or radio) on the left. Toggles on click. */
  selector?: MenuItemSelector;
  /** Show a switcher (toggle) on the right. Toggles on click. */
  toggle?: boolean;
  /** Controlled checked state for selector/toggle */
  checked?: boolean;
  /** Default checked state for selector/toggle (uncontrolled) */
  defaultChecked?: boolean;
  /** Called when selector/toggle checked state changes */
  onCheckedChange?: (checked: boolean) => void;
  /** Vertical layout: icon on top, label below */
  vertical?: boolean;
  /** Label text */
  children: ReactNode;
};

const SELECTOR_SIZE: Record<PadSize, CheckboxSize> = { lg: 'l', md: 'm', sm: 's' };

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      padSize: padSizeProp,
      textSize: textSizeProp,
      selected = false,
      disabled = false,
      iconLeft,
      leadSlot,
      showIconLeft = true,
      selector,
      toggle = false,
      checked: checkedProp,
      defaultChecked = false,
      onCheckedChange,
      vertical = false,
      children,
      className,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const padSize = padSizeProp ?? 'md';
    const textSize = textSizeProp ?? 14;
    const hasControl = !!selector || toggle;

    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = checkedProp !== undefined;
    const isChecked = hasControl && (isControlled ? checkedProp : internalChecked);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (hasControl) {
          const next = !isChecked;
          if (!isControlled) setInternalChecked(next);
          onCheckedChange?.(next);
        }
        onClick?.(e);
      },
      [hasControl, isChecked, isControlled, onCheckedChange, onClick],
    );

    const showCheck = !toggle && selected;

    const cls = [
      s.item,
      vertical && s.vertical,
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      showCheck && s.selected,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const selectorSize = SELECTOR_SIZE[padSize];

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={ref}
          role="menuitem"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-checked={hasControl ? isChecked : undefined}
          className={cls}
          onClick={disabled ? undefined : handleClick}
          onKeyDown={
            disabled
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                  }
                }
          }
          {...rest}
        >
          {/* Left slot: selector or icon */}
          {selector === 'checkbox' && (
            <span
              className={selectorStyles.selectorWrap}
              style={{ width: 'var(--fui-current-icon-box)', height: 'var(--fui-current-icon-box)' }}
            >
              <Checkbox size={selectorSize} checked={isChecked} disabled={disabled} aria-hidden />
            </span>
          )}
          {selector === 'radio' && (
            <span
              className={selectorStyles.selectorWrap}
              style={{ width: 'var(--fui-current-icon-box)', height: 'var(--fui-current-icon-box)' }}
            >
              <Radio size={selectorSize} checked={isChecked} disabled={disabled} aria-hidden />
            </span>
          )}
          {!selector && showIconLeft && leadSlot}
          {!selector && showIconLeft && !leadSlot && iconLeft && (
            <IconBox icon={iconLeft} className={s.iconLeft} />
          )}

          {/* Label */}
          <span className={s.label}>{children}</span>

          {/* Right slot: switcher or check mark */}
          {toggle && (
            <span className={selectorStyles.selectorWrap}>
              <Switcher size={selectorSize} checked={isChecked} disabled={disabled} aria-hidden />
            </span>
          )}
          {!toggle && selected && !vertical && (
            <IconBox icon={Tick02Icon} className={s.checkIcon} />
          )}
        </div>
      </TextSizeProvider>
    );
  },
);

MenuItem.displayName = 'MenuItem';
