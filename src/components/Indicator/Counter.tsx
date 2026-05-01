import { forwardRef, type HTMLAttributes } from 'react';
import { TEXT_CLASS, type TextSize } from '../../tokens/size';
import s from './Indicator.module.css';

export type CounterColor = 'brand' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type CounterVariant = 'solid' | 'soft';

export interface CounterProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number;
  /** Maximum displayed value. Shows `{max}+` when exceeded. */
  max?: number;
  color?: CounterColor;
  variant?: CounterVariant;
  /** Explicit text-axis size. When omitted, inherits from nearest `.fui-text-*` ancestor. */
  size?: TextSize;
}

export const Counter = forwardRef<HTMLSpanElement, CounterProps>(
  ({ value, max, color = 'brand', variant = 'solid', size, className, ...rest }, ref) => {
    const label = max != null && value > max ? `${max}+` : `${value}`;

    const cls = [s.base, s.counter, s[variant], s[color], size ? TEXT_CLASS[size] : undefined, className]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={cls} {...rest}>
        {label}
      </span>
    );
  },
);

Counter.displayName = 'Counter';
