import { forwardRef, useState, useCallback, type HTMLAttributes } from 'react';
import s from './Selector.module.css';

export type SwitcherSize = 'l' | 'm' | 's';

export type SwitcherProps = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onChange'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitcherSize;
  disabled?: boolean;
};

export const Switcher = forwardRef<HTMLDivElement, SwitcherProps>(
  ({ checked: checkedProp, defaultChecked = false, onCheckedChange, size = 'm', disabled = false, className, onClick, ...rest }, ref) => {
    const isControlled = checkedProp !== undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const checked = isControlled ? checkedProp : internalChecked;

    const toggle = useCallback(() => {
      if (disabled) return;
      const next = !checked;
      if (!isControlled) setInternalChecked(next);
      onCheckedChange?.(next);
    }, [disabled, checked, isControlled, onCheckedChange]);

    const cls = [
      s.switcher,
      size === 'l' && s.large,
      size === 's' && s.small,
      checked && s.checked,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={ref}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={cls}
        onClick={(e) => { toggle(); onClick?.(e); }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
          rest.onKeyDown?.(e);
        }}
        {...rest}
      >
        <div className={s.switcherThumb} />
      </div>
    );
  },
);

Switcher.displayName = 'Switcher';
