import { useMemo, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Checkbox } from '../../components/Selector/Checkbox';
import type { Orphan } from '../../figma-builder/apply';

interface OrphansModalProps {
  orphans: Orphan[];
  onConfirm: (idsToDelete: string[]) => void;
  onClose: () => void;
}

export function OrphansModal({ orphans, onConfirm, onClose }: OrphansModalProps) {
  // Default: all checked. The user explicitly opens this modal after a sync
  // and the goal is cleanup; one click "Delete selected" handles the common case.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(orphans.map((o) => o.id)),
  );

  const allChecked = selected.size === orphans.length;
  const noneChecked = selected.size === 0;
  const someChecked = !allChecked && !noneChecked;

  const grouped = useMemo(() => {
    const primitives: Orphan[] = [];
    const semantics: Orphan[] = [];
    for (const o of orphans) {
      (o.collection === 'primitives' ? primitives : semantics).push(o);
    }
    primitives.sort((a, b) => a.name.localeCompare(b.name));
    semantics.sort((a, b) => a.name.localeCompare(b.name));
    return { primitives, semantics };
  }, [orphans]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(orphans.map((o) => o.id)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unused variables found"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          backgroundColor: 'var(--fui-neutral-1)',
          border: '1px solid var(--fui-neutral-6)',
          borderRadius: 'var(--fui-radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fui-neutral-12)' }}>
            Unused variables found
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--fui-neutral-10)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {orphans.length} variable{orphans.length === 1 ? '' : 's'} in this file aren&apos;t produced
            by the current spec. Uncheck any you want to keep.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderTop: '1px solid var(--fui-neutral-4)',
            borderBottom: '1px solid var(--fui-neutral-4)',
          }}
        >
          <Checkbox
            size="s"
            checked={allChecked}
            indeterminate={someChecked}
            onCheckedChange={toggleAll}
          />
          <button
            onClick={toggleAll}
            style={{
              fontSize: 12,
              color: 'var(--fui-neutral-11)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {allChecked ? 'Uncheck all' : 'Check all'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)', marginLeft: 'auto' }}>
            {selected.size} selected
          </span>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {(['primitives', 'semantics'] as const).map((section) => {
            const list = grouped[section];
            if (list.length === 0) return null;
            return (
              <div key={section} style={{ padding: '8px 0' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fui-neutral-9)',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '4px 20px',
                  }}
                >
                  {section}
                </div>
                {list.map((o) => (
                  <label
                    key={o.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 20px',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--fui-neutral-12)',
                    }}
                  >
                    <Checkbox
                      size="s"
                      checked={selected.has(o.id)}
                      onCheckedChange={() => toggle(o.id)}
                    />
                    <span style={{ fontFamily: 'var(--fui-font-mono, monospace)' }}>{o.name}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: 16,
            borderTop: '1px solid var(--fui-neutral-4)',
          }}
        >
          <Button buttonType="secondary" onClick={onClose}>
            Keep all
          </Button>
          <Button
            buttonType="primary"
            status="error"
            disabled={noneChecked}
            onClick={() => onConfirm(Array.from(selected))}
          >
            Delete selected ({selected.size})
          </Button>
        </div>
      </div>
    </div>
  );
}
