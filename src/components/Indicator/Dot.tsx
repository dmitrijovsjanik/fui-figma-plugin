import { forwardRef, type HTMLAttributes } from 'react';
import { TEXT_CLASS, type TextSize } from '../../tokens/size';
import s from './Indicator.module.css';

export type DotColor = 'brand' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type DotShape = 'circle' | 'square' | 'triangle';

export interface DotProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  color?: DotColor;
  shape?: DotShape;
  /** Explicit text-axis size. When omitted, inherits from nearest `.fui-text-*` ancestor. */
  size?: TextSize;
}

export const Dot = forwardRef<HTMLSpanElement, DotProps>(
  ({ color = 'brand', shape = 'circle', size, className, ...rest }, ref) => {
    const cls = [s.base, s.dot, s[color], s[shape], size ? TEXT_CLASS[size] : undefined, className]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={cls} {...rest}>
        <span className={s.dotInner} />
      </span>
    );
  },
);

Dot.displayName = 'Dot';
