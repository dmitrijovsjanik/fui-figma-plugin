import {
  forwardRef,
  useState,
  useCallback,
  useRef,
  type HTMLAttributes,
} from 'react';
import { Avatar } from './Avatar';
import type { AvatarSize } from './Avatar';
import { Dropdown } from '../Dropdown/Dropdown';
import { MenuItem } from '../Menu/MenuItem';
import s from './AvatarGroup.module.css';
import { ICON_BOX, MENU_ITEM_HEIGHT, type PadSize, type TextSize } from '../../tokens/size';

/* ─── Types ─── */

export interface AvatarGroupItem {
  /** Unique key */
  key: string;
  /** Full name */
  name: string;
  /** Image URL */
  src?: string;
}

export interface AvatarGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** List of people */
  items: AvatarGroupItem[];
  /** Size variant */
  size?: AvatarSize;
  /** Maximum visible avatars (rest collapse into a "+N" counter) */
  max?: number;
  /** Outline color for the ring (defaults to #fff) */
  outlineColor?: string;
}

/** Overlap per size in px */
const OVERLAP: Record<AvatarSize, number> = { md: 12, sm: 10, xs: 6 };

/** Avatar pixel size per size token */
const AVATAR_PX: Record<AvatarSize, number> = { md: 48, sm: 36, xs: 24 };

/** Map AvatarSize → PadSize for dropdown/menu sizing */
const AVATAR_PAD: Record<AvatarSize, PadSize> = { xs: 'sm', sm: 'md', md: 'lg' };

/** Map AvatarSize → TextSize for menu items */
const AVATAR_TEXT: Record<AvatarSize, TextSize> = { xs: 12, sm: 14, md: 16 };


/* ─── Component ─── */

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  (
    {
      items,
      size = 'md',
      max = 5,
      outlineColor,
      className,
      ...rest
    },
    ref,
  ) => {
    const visibleCount = Math.min(max, items.length);
    const overflowCount = items.length - visibleCount;
    const visible = items.slice(0, visibleCount);
    const overflow = items.slice(visibleCount);

    const overlap = OVERLAP[size];

    /* ─── Dropdown state ─── */
    const [menuOpen, setMenuOpen] = useState(false);
    const counterRef = useRef<HTMLSpanElement>(null);

    const toggleMenu = useCallback(() => {
      setMenuOpen((prev) => !prev);
    }, []);

    const cls = [s.group, className].filter(Boolean).join(' ');

    const avatarPx = AVATAR_PX[size];
    const counterFontSize = size === 'md' ? 14 : size === 'sm' ? 12 : 10;

    return (
      <div
        ref={ref}
        className={cls}
        style={{ '--fui-avatar-overlap': `${overlap}px` } as React.CSSProperties}
        {...rest}
      >
        {visible.map((item, i) => (
          <div
            key={item.key}
            className={[s.slot, i === visibleCount - 1 && overflowCount === 0 ? s.last : ''].filter(Boolean).join(' ')}
            style={{
              marginLeft: i > 0 ? -overlap : 0,
              zIndex: i + 1,
            }}
          >
            <Avatar
              src={item.src}
              name={item.name}
              size={size}
              outlined
              outlineColor={outlineColor}
            />
          </div>
        ))}

        {overflowCount > 0 && (
          <>
            <span
              ref={counterRef}
              className={[s.counter, s[size]].join(' ')}
              style={{
                marginLeft: -overlap,
                zIndex: visibleCount + 1,
                width: avatarPx,
                height: avatarPx,
                fontSize: counterFontSize,
                '--fui-avatar-outline-color': outlineColor ?? '#fff',
              } as React.CSSProperties}
              role="button"
              tabIndex={0}
              aria-label={`${overflowCount} more people`}
              onClick={toggleMenu}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleMenu();
                }
              }}
            >
              +{overflowCount}
            </span>

            <Dropdown
              anchorRef={counterRef}
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              itemHeight={MENU_ITEM_HEIGHT[AVATAR_PAD[size]]}
              maxVisible={6}
              align="start"
              minWidth={180}
            >
              {overflow.map((item) => (
                <MenuItem
                  key={item.key}
                  padSize={AVATAR_PAD[size]}
                  textSize={AVATAR_TEXT[size]}
                  leadSlot={
                    <Avatar
                      src={item.src}
                      name={item.name}
                      style={{ width: ICON_BOX[AVATAR_TEXT[size]], height: ICON_BOX[AVATAR_TEXT[size]], fontSize: ICON_BOX[AVATAR_TEXT[size]] * 0.5 }}
                    />
                  }
                >
                  {item.name}
                </MenuItem>
              ))}
            </Dropdown>
          </>
        )}
      </div>
    );
  },
);

AvatarGroup.displayName = 'AvatarGroup';
