import { forwardRef, createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { ICON_SIZE, ICON_STROKE_WIDTH, type TextSize } from '../../tokens/size';
import s from './IconBox.module.css';

export type IconBoxBehavior = 'static' | 'ghost' | 'highlight' | 'functional';

/* ─── Context: parent components set the numeric text size so IconBox can
   pass the correct value to HugeiconsIcon for absoluteStrokeWidth calc. ─── */

const TextSizeContext = createContext<TextSize>(14);

/** Wrap children to provide the current text size for IconBox stroke calculation. */
export function TextSizeProvider({ size, children }: { size: TextSize; children: ReactNode }) {
  return <TextSizeContext.Provider value={size}>{children}</TextSizeContext.Provider>;
}

type StaticProps = {
  /** Display mode. `static` = decorative, `ghost` = bg on hover, `highlight` = icon color on hover. */
  behavior?: 'static';
  icon: IconSvgElement;
  className?: string;
};

type InteractiveProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  behavior: 'ghost' | 'highlight' | 'functional';
  icon: IconSvgElement;
};

export type IconBoxProps = StaticProps | InteractiveProps;

export const IconBox = forwardRef<HTMLButtonElement | HTMLSpanElement, IconBoxProps>(
  (props, ref) => {
    const { icon, behavior = 'static', className } = props;

    const boxSize = 'var(--fui-current-icon-box)';

    // Read numeric text size from context for absoluteStrokeWidth compensation
    const textSize = useContext(TextSizeContext);
    const numericIconSize = ICON_SIZE[textSize];

    const iconEl = (
      <HugeiconsIcon
        icon={icon}
        size={numericIconSize}
        strokeWidth={ICON_STROKE_WIDTH}
        absoluteStrokeWidth
        style={{
          width: 'var(--fui-current-icon-size)',
          height: 'var(--fui-current-icon-size)',
        }}
      />
    );

    if (behavior !== 'static') {
      const { icon: _icon, behavior: _b, className: _cls, ...buttonProps } = props as InteractiveProps;

      const cls = [s.interactive, s[behavior], className]
        .filter(Boolean)
        .join(' ');

      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          {...buttonProps}
          className={cls}
          style={{
            width: boxSize,
            height: boxSize,
          }}
        >
          {iconEl}
        </button>
      );
    }

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={className || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: boxSize,
          height: boxSize,
          flexShrink: 0,
        }}
      >
        {iconEl}
      </span>
    );
  },
);

IconBox.displayName = 'IconBox';
