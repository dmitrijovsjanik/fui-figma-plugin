import { useState, useRef, useCallback } from 'react';
import type { NamingConfig, TemplateVariable, SemanticRole } from '../../palette-core';
import { TEMPLATE_VARIABLES, SEMANTIC_ROLES, DEFAULT_NAMING_CONFIG, resolveTokenName } from '../../palette-core';
import { TextInline } from '../../components/Input/TextInline';
import { GripVertical, X, Plus, RotateCcw, Info } from 'lucide-react';

interface NamingTemplateBuilderProps {
  config: NamingConfig;
  onChange: (config: NamingConfig) => void;
}

function getVariableOrder(config: NamingConfig): TemplateVariable[] {
  return config.segments
    .filter((s): s is { type: 'variable'; value: TemplateVariable } => s.type === 'variable')
    .map(s => s.value);
}

function getSeparator(config: NamingConfig): string {
  const sep = config.segments.find(s => s.type === 'separator');
  return sep ? sep.value : '/';
}

function rebuildSegments(order: TemplateVariable[], separator: string): NamingConfig['segments'] {
  const segments: NamingConfig['segments'] = [];
  for (let i = 0; i < order.length; i++) {
    if (i > 0) segments.push({ type: 'separator', value: separator });
    segments.push({ type: 'variable', value: order[i] });
  }
  return segments;
}

export function NamingTemplateBuilder({ config, onChange }: NamingTemplateBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const variableOrder = getVariableOrder(config);
  const separator = getSeparator(config);
  const availableVariables = TEMPLATE_VARIABLES.filter(v => !variableOrder.includes(v));
  const isDefault = JSON.stringify(config.segments) === JSON.stringify(DEFAULT_NAMING_CONFIG.segments);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4';
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    dragNodeRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragIndex !== index) {
      setDropTarget(index);
    }
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;

    const newOrder = [...variableOrder];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    onChange({ ...config, segments: rebuildSegments(newOrder, separator) });
    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, variableOrder, separator, config, onChange]);

  const removeVariable = useCallback((index: number) => {
    const newOrder = [...variableOrder];
    newOrder.splice(index, 1);
    onChange({ ...config, segments: rebuildSegments(newOrder, separator) });
  }, [variableOrder, separator, config, onChange]);

  const addVariable = useCallback((variable: TemplateVariable) => {
    const newOrder = [...variableOrder, variable];
    onChange({ ...config, segments: rebuildSegments(newOrder, separator) });
  }, [variableOrder, separator, config, onChange]);

  const resetTemplate = useCallback(() => {
    onChange({ ...config, segments: DEFAULT_NAMING_CONFIG.segments });
  }, [config, onChange]);

  const updateSeparator = useCallback((value: string) => {
    onChange({ ...config, segments: rebuildSegments(variableOrder, value) });
  }, [variableOrder, config, onChange]);

  const updateRoleName = (role: SemanticRole, name: string) => {
    onChange({ ...config, roleNames: { ...config.roleNames, [role]: name } });
  };

  const updateThemeName = (theme: 'light' | 'dark', name: string) => {
    onChange({ ...config, themeNames: { ...config.themeNames, [theme]: name } });
  };

  const updateModeName = (mode: 'solid' | 'alpha', name: string) => {
    onChange({ ...config, modeNames: { ...config.modeNames, [mode]: name } });
  };

  const preview = resolveTokenName(config, 'light', 'brand', 'solid', 9);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Token Name Template</span>
          {!isDefault && (
            <button
              type="button"
              onClick={resetTemplate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fui-neutral-9)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <RotateCcw style={{ height: 12, width: 12 }} />
              Reset
            </button>
          )}
        </div>

        {/* Draggable template builder */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          minHeight: 36,
          borderRadius: 'var(--fui-radius-md)',
          border: '1px solid var(--fui-neutral-6)',
          backgroundColor: 'var(--fui-neutral-1)',
          paddingInline: 8,
          paddingBlock: 6,
        }}>
          {variableOrder.map((variable, i) => (
            <div key={variable} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && (
                <input
                  type="text"
                  value={separator}
                  onChange={(e) => updateSeparator(e.target.value)}
                  style={{
                    width: `${Math.max(separator.length, 1) * 8 + 4}px`,
                    minWidth: 12,
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--fui-neutral-9)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              )}
              <div
                draggable
                onDragStart={(e) => {
                  dragNodeRef.current = e.currentTarget as HTMLDivElement;
                  handleDragStart(e, i);
                }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, i)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 'var(--fui-radius-md)',
                  paddingRight: 8,
                  paddingLeft: 2,
                  paddingBlock: 2,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'grab',
                  userSelect: 'none',
                  backgroundColor: dropTarget === i
                    ? 'var(--fui-neutral-a-3)'
                    : dragIndex === i
                      ? 'var(--fui-neutral-a-3)'
                      : 'var(--fui-neutral-a-3)',
                  color: 'var(--fui-neutral-12)',
                  outline: dropTarget === i ? '2px solid var(--fui-brand-a-3)' : undefined,
                }}
              >
                <GripVertical style={{ height: 12, width: 12, opacity: 0.4 }} />
                {variable}
                {variableOrder.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeVariable(i); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginRight: -2, color: 'inherit' }}
                  >
                    <X style={{ height: 12, width: 12 }} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {availableVariables.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              {availableVariables.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => addVariable(v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    color: 'var(--fui-neutral-9)',
                    borderRadius: 'var(--fui-radius-md)',
                    paddingInline: 6,
                    paddingBlock: 2,
                    fontSize: 12,
                    border: '1px dashed var(--fui-neutral-6)',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus style={{ height: 12, width: 12 }} />
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <p style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>
          Preview: <code style={{ fontSize: 12, backgroundColor: 'var(--fui-neutral-a-3)', paddingInline: 4, borderRadius: 'var(--fui-radius-md)', fontFamily: 'monospace' }}>{preview}</code>
        </p>
      </div>

      {/* Variable value renaming */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Variable Values</span>
        <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
          {/* Theme names */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 48, color: 'var(--fui-neutral-9)', flexShrink: 0 }}>theme</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {(['light', 'dark'] as const).map(theme => (
                <InlineInput
                  key={theme}
                  value={config.themeNames[theme]}
                  defaultValue={DEFAULT_NAMING_CONFIG.themeNames[theme]}
                  onChange={(v) => updateThemeName(theme, v)}
                />
              ))}
            </div>
          </div>

          {/* Role names */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ width: 48, color: 'var(--fui-neutral-9)', flexShrink: 0, paddingTop: 4 }}>role</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {SEMANTIC_ROLES.map(role => (
                <InlineInput
                  key={role}
                  value={config.roleNames[role]}
                  defaultValue={DEFAULT_NAMING_CONFIG.roleNames[role]}
                  onChange={(v) => updateRoleName(role, v)}
                />
              ))}
            </div>
          </div>

          {/* Mode names */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 48, color: 'var(--fui-neutral-9)', flexShrink: 0 }}>mode</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {(['solid', 'alpha'] as const).map(mode => (
                <InlineInput
                  key={mode}
                  value={config.modeNames[mode]}
                  defaultValue={DEFAULT_NAMING_CONFIG.modeNames[mode]}
                  onChange={(v) => updateModeName(mode, v)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineInput({ value, defaultValue, onChange }: { value: string; defaultValue: string; onChange: (v: string) => void }) {
  const isCustom = value !== defaultValue;

  const handleChange = (input: string) => {
    if (input === '') {
      onChange(defaultValue);
    } else {
      onChange(input);
    }
  };

  return (
    <div style={{ display: 'inline-flex', width: 80 }}>
      <TextInline
        value={isCustom ? value : ''}
        placeholder={defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        padSize="md"
        textSize={14}
        showLabel={false}
        showCaption={false}
        clearable={isCustom}
        onClear={() => onChange(defaultValue)}
      />
    </div>
  );
}
