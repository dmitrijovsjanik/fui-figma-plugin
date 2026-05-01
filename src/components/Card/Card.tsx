import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import s from './Card.module.css';

export type CardVariant = 'ghost' | 'secondary';
export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  pressed?: boolean;
  children?: ReactNode;
}

const PAD_CLS: Record<CardPadding, string> = {
  sm: s.padSm,
  md: s.padMd,
  lg: s.padLg,
};

export const Card = forwardRef<HTMLButtonElement, CardProps>(
  ({ variant = 'ghost', padding = 'lg', pressed, className, children, ...rest }, ref) => {
    const cls = [
      s.card,
      s[variant],
      PAD_CLS[padding],
      pressed && s.pressed,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={cls} {...rest}>
        {children}
      </button>
    );
  },
);

Card.displayName = 'Card';
