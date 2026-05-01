import { forwardRef, useState, useCallback, type HTMLAttributes } from 'react';
import s from './Selector.module.css';

export type RadioSize = 'l' | 'm' | 's';
export type RadioStatus = 'default' | 'error';

export type RadioProps = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onChange'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: RadioSize;
  status?: RadioStatus;
  disabled?: boolean;
};

export const Radio = forwardRef<HTMLDivElement, RadioProps>(
  ({ checked: checkedProp, defaultChecked = false, onCheckedChange, size = 'm', status = 'default', disabled = false, className, onClick, ...rest }, ref) => {
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
      s.radio,
      size === 'l' && s.large,
      size === 's' && s.small,
      checked && s.checked,
      status === 'error' && s.error,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={ref}
        role="radio"
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
        {checked && <div className={s.radioDot} />}
      </div>
    );
  },
);

Radio.displayName = 'Radio';
