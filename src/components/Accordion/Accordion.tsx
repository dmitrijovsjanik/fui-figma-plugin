import {
  forwardRef,
  useState,
  useCallback,
  useRef,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { IconBox, TextSizeProvider } from '../Icon/IconBox';
import s from './Accordion.module.css';
import { PAD_CLASS, TEXT_CLASS, type PadSize, type TextSize } from '../../tokens/size';

/* ─── Types ─── */

export type AccordionVariant = 'inline' | 'panel' | 'filled';

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual format */
  variant?: AccordionVariant;
  /** Padding / density */
  padSize?: PadSize;
  /** Text / typography */
  textSize?: TextSize;
  /** Controlled open state */
  open?: boolean;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Header / trigger content */
  title: ReactNode;
  /** Actions rendered to the right of the trigger (outside the toggle button) */
  actions?: ReactNode;
  /** Expandable body */
  children: ReactNode;
}

/* ─── Component ─── */

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      variant = 'panel',
      padSize = 'md',
      textSize = 14,
      open: openProp,
      defaultOpen = false,
      onOpenChange,
      disabled = false,
      title,
      actions,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const isControlled = openProp !== undefined;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = isControlled ? openProp : internalOpen;

    /* Animate body height — manipulate DOM directly to guarantee reflow between frames */
    const bodyRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);
    const timerRef = useRef(0);
    const firstRender = useRef(true);
    useEffect(() => {
      const body = bodyRef.current;
      const inner = innerRef.current;
      if (!body || !inner) return;

      // Skip animation on first render — just set the correct initial state
      if (firstRender.current) {
        firstRender.current = false;
        if (isOpen) {
          body.style.display = 'block';
          body.style.height = 'auto';
        } else {
          body.style.display = 'none';
          body.style.height = '0px';
        }
        return;
      }

      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);

      if (isOpen) {
        // Show, measure, then animate 0 → h → auto
        body.style.display = 'block';
        body.style.height = '0px';
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        body.offsetHeight; // force reflow
        const h = inner.scrollHeight;
        body.style.height = `${h}px`;
        timerRef.current = window.setTimeout(() => {
          body.style.height = 'auto';
        }, 200);
      } else {
        // Collapse: auto → h → 0 → hide
        const h = inner.scrollHeight;
        body.style.height = `${h}px`;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        body.offsetHeight; // force reflow

        rafRef.current = requestAnimationFrame(() => {
          body.style.height = '0px';
        });
        timerRef.current = window.setTimeout(() => {
          body.style.display = 'none';
        }, 200);
      }

      return () => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(timerRef.current);
      };
    }, [isOpen]);

    const toggle = useCallback(() => {
      if (disabled) return;
      const next = !isOpen;
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    }, [disabled, isOpen, isControlled, onOpenChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      },
      [toggle],
    );

    const rootCls = [
      s.accordion,
      s[variant],
      PAD_CLASS[padSize],
      TEXT_CLASS[textSize],
      isOpen && s.open,
      disabled && s.disabled,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const isFilled = variant === 'filled';

    return (
      <TextSizeProvider size={textSize}>
        <div
          ref={ref}
          className={rootCls}
          role={isFilled ? 'button' : undefined}
          tabIndex={isFilled && !disabled ? 0 : undefined}
          aria-expanded={isFilled ? isOpen : undefined}
          onClick={isFilled && !disabled ? toggle : undefined}
          onKeyDown={isFilled ? handleKeyDown : undefined}
          {...rest}
        >
          <div className={s.header}>
            <button
              type="button"
              className={s.trigger}
              onClick={isFilled ? undefined : toggle}
              onKeyDown={isFilled ? undefined : handleKeyDown}
              disabled={disabled}
              aria-expanded={isOpen}
              tabIndex={isFilled ? -1 : 0}
            >
              <IconBox icon={ArrowRight01Icon} behavior="highlight" className={s.chevron} />
              <span className={s.title}>{title}</span>
            </button>
            {actions}
          </div>

          <div
            ref={bodyRef}
            className={s.body}
            style={defaultOpen ? { height: 'auto' } : { height: 0, display: 'none' }}
            aria-hidden={!isOpen}
          >
            <div ref={innerRef} className={s.bodyInner}>
              {children}
            </div>
          </div>
        </div>
      </TextSizeProvider>
    );
  },
);

Accordion.displayName = 'Accordion';
