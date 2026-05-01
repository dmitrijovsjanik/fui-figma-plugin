import { useCallback, useRef } from 'react';
import { postToSandbox } from '../persistence';
import { MIN_WINDOW_SIZE } from '../persistence-types';

interface ResizeHandleProps {
  onResize: (width: number, height: number) => void;
}

// Bottom-right corner drag handle. While dragging, sends resize messages to
// sandbox at ~60fps via requestAnimationFrame; on release, persists the final
// size via the onResize callback (parent saves to clientStorage).
export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    rafId: number | null;
    pendingW: number;
    pendingH: number;
  } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight,
      rafId: null,
      pendingW: window.innerWidth,
      pendingH: window.innerHeight,
    };

    const flushResize = () => {
      const s = dragStateRef.current;
      if (!s) return;
      postToSandbox({ type: 'resize', width: s.pendingW, height: s.pendingH });
      s.rafId = null;
    };

    const handleMove = (ev: MouseEvent) => {
      const s = dragStateRef.current;
      if (!s) return;
      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;
      s.pendingW = Math.max(MIN_WINDOW_SIZE.width, Math.round(s.startWidth + dx));
      s.pendingH = Math.max(MIN_WINDOW_SIZE.height, Math.round(s.startHeight + dy));
      if (s.rafId === null) {
        s.rafId = requestAnimationFrame(flushResize);
      }
    };

    const handleUp = () => {
      const s = dragStateRef.current;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (s) {
        if (s.rafId !== null) cancelAnimationFrame(s.rafId);
        // Final resize + persist
        postToSandbox({ type: 'resize', width: s.pendingW, height: s.pendingH });
        onResize(s.pendingW, s.pendingH);
      }
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      title="Drag to resize"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        width: 16,
        height: 16,
        cursor: 'nwse-resize',
        background:
          'linear-gradient(135deg, transparent 0%, transparent 50%, var(--fui-neutral-9) 50%, var(--fui-neutral-9) 60%, transparent 60%, transparent 70%, var(--fui-neutral-9) 70%, var(--fui-neutral-9) 80%, transparent 80%)',
        zIndex: 9999,
      }}
    />
  );
}
