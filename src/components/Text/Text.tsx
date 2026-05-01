import { type ElementType, type ComponentPropsWithRef, forwardRef } from 'react';
import styles from './Text.module.css';

export type TextSize = 56 | 48 | 40 | 36 | 32 | 28 | 24 | 22 | 20 | 18 | 16 | 14 | 12;
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type TextLineHeight = 'auto' | 'compact' | 'fine';

export interface TextOwnProps {
  size?: TextSize;
  weight?: TextWeight;
  lineHeight?: TextLineHeight;
  as?: ElementType;
}

export type TextProps = TextOwnProps &
  Omit<ComponentPropsWithRef<'span'>, keyof TextOwnProps>;

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      size = 16,
      weight = 'normal',
      lineHeight = 'auto',
      as: Component = 'span',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const hasVariants = size <= 24;
    let lhClass: string | undefined;

    if (hasVariants) {
      if (lineHeight === 'auto') {
        const text = typeof children === 'string' ? children : '';
        const variant = text.length > 40 ? 'fine' : 'compact';
        lhClass = styles[`lh-${size}-${variant}`];
      } else {
        lhClass = styles[`lh-${size}-${lineHeight}`];
      }
    } else {
      lhClass = styles[`lh-${size}`];
    }

    const cls = [
      styles.text,
      styles[`size-${size}`],
      styles[`weight-${weight}`],
      lhClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Component ref={ref} className={cls} {...props}>
        {children}
      </Component>
    );
  },
);

Text.displayName = 'Text';
