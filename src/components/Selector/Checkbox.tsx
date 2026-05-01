import { forwardRef, useState, useCallback, type HTMLAttributes } from 'react';
import s from './Selector.module.css';

export type CheckboxSize = 'l' | 'm' | 's';
export type CheckboxStatus = 'default' | 'error';

export type CheckboxProps = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onChange'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Indeterminate (mixed) state — takes visual priority over checked */
  indeterminate?: boolean;
  size?: CheckboxSize;
  status?: CheckboxStatus;
  disabled?: boolean;
};

export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(
  ({ checked: checkedProp, defaultChecked = false, onCheckedChange, indeterminate = false, size = 'm', status = 'default', disabled = false, className, onClick, ...rest }, ref) => {
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
      s.checkbox,
      size === 'l' && s.large,
      size === 's' && s.small,
      indeterminate ? s.indeterminate : checked && s.checked,
      status === 'error' && s.error,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const iconSize = size === 'l' ? 12 : size === 's' ? 9 : 10;

    return (
      <div
        ref={ref}
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
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
        {indeterminate ? (
          <svg className={s.checkmarkBrand} width={iconSize} height={iconSize} viewBox="0 0 12 12" fill="none">
            <path d="M3 6H9" stroke="var(--fui-brand-9)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : checked ? (
          <svg className={s.checkmark} width={iconSize} height={iconSize} viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--fui-neutral-0)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
