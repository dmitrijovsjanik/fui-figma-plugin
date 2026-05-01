import { forwardRef, useState, type HTMLAttributes } from 'react';
import s from './Avatar.module.css';
export type AvatarSize = 'xs' | 'sm' | 'md';

export interface AvatarProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Image URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Full name — used to derive initials when no src or image fails to load */
  name?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Show a 2px outline ring (e.g. for stacking avatars on a colored background) */
  outlined?: boolean;
  /** Outline color override (defaults to #fff) */
  outlineColor?: string;
}

/** Extract initials: "John Doe" → "JD", "Alice" → "A" */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '').toUpperCase();
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      outlined = false,
      outlineColor,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    const [imgError, setImgError] = useState(false);
    const showImage = !!src && !imgError;
    const initials = name ? getInitials(name) : '';

    const cls = [
      s.avatar,
      s[size],
      outlined && s.outlined,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const mergedStyle =
      outlineColor
        ? { ...style, '--fui-avatar-outline-color': outlineColor } as React.CSSProperties
        : style;

    return (
      <span ref={ref} className={cls} style={mergedStyle} role="img" aria-label={alt ?? name ?? 'avatar'} {...rest}>
        {showImage ? (
          <img
            className={s.image}
            src={src}
            alt={alt ?? name ?? ''}
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={s.initials}>{initials}</span>
        )}
      </span>
    );
  },
);

Avatar.displayName = 'Avatar';
