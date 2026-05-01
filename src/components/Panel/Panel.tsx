import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import s from './Panel.module.css';
import { PAD_CLASS, type PadSize, type TextSize } from '../../tokens/size';

/* ─── Size mapping ─── */

export type PanelSize = 'sm' | 'md' | 'lg';

/** Panel padding follows size directly */
const SIZE_TO_PAD: Record<PanelSize, PadSize> = { sm: 'sm', md: 'md', lg: 'lg' };

/** Inner components are capped at md — lg panels still use md-sized controls */
export type InnerSize = 'sm' | 'md';
const SIZE_TO_INNER: Record<PanelSize, InnerSize> = { sm: 'sm', md: 'md', lg: 'md' };

/* ─── Slot type: static ReactNode or render function receiving inner size ─── */

type SlotContent = ReactNode | ((innerSize: InnerSize) => ReactNode);

function renderSlot(slot: SlotContent | undefined, innerSize: InnerSize): ReactNode {
  if (slot === undefined || slot === null) return null;
  if (typeof slot === 'function') return slot(innerSize);
  return slot;
}

/* ─── Types ─── */

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Panel size — controls padding; inner components are capped at md */
  size?: PanelSize;
  /** Header title text */
  title: ReactNode;
  /** Content rendered before the title. Accepts ReactNode or (innerSize) => ReactNode */
  leadSlot?: SlotContent;
  /** Content rendered to the right. Accepts ReactNode or (innerSize) => ReactNode */
  trailSlot?: SlotContent;
}

/* ─── Component ─── */

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      size = 'md',
      title,
      leadSlot,
      trailSlot,
      className,
      ...rest
    },
    ref,
  ) => {
    const innerSize = SIZE_TO_INNER[size];

    const rootCls = [
      s.panel,
      PAD_CLASS[SIZE_TO_PAD[size]],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const leadingContent = renderSlot(leadSlot, innerSize);
    const actionsContent = renderSlot(trailSlot, innerSize);

    return (
      <div ref={ref} className={rootCls} {...rest}>
        {leadingContent}
        <span className={s.title}>{title}</span>
        {actionsContent && <div className={s.actions}>{actionsContent}</div>}
      </div>
    );
  },
);

Panel.displayName = 'Panel';
