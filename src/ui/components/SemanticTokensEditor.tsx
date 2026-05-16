// Full-page editor for the semantic-token graph. Mounted in PluginApp when
// the user enters the "tokens" view mode. Edits go through callbacks; the
// parent owns state + persistence.

import { useState } from 'react';
import {
  DEFAULT_SEMANTIC_CONFIG,
  SEMANTIC_ROLES,
  type SemanticConfig,
  type SemanticSectionConfig,
  type StandaloneToken,
  type RoleSlot,
  type PrimitiveRef,
  type GenerationResult,
  type SemanticRole,
  type NamingConfig,
} from '../../palette-core';
import { Button } from '../../components/Button/Button';
import { TextInline } from '../../components/Input/TextInline';
import { PrimitiveRefPicker } from './PrimitiveRefPicker';

// Cheap unique-id generator — collisions are not a concern since the keymap
// only needs uniqueness within one user's clientStorage. We avoid pulling in a
// real uuid package to keep the bundle small.
function newId(): string {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export interface SemanticTokensEditorProps {
  config: SemanticConfig;
  onChange: (next: SemanticConfig) => void;
  namingConfig: NamingConfig;
  previewResult: GenerationResult | null;
  includeSecondary: boolean;
  onExit: () => void;
}

export function SemanticTokensEditor({
  config,
  onChange,
  namingConfig,
  previewResult,
  includeSecondary,
  onExit,
}: SemanticTokensEditorProps) {
  const updateSection = (id: string, patch: Partial<SemanticSectionConfig>) => {
    onChange({
      sections: config.sections.map(s => s.id === id ? { ...s, ...patch } : s),
    });
  };

  const removeSection = (id: string) => {
    if (!confirm('Remove this section and all its tokens?')) return;
    onChange({ sections: config.sections.filter(s => s.id !== id) });
  };

  const addSection = () => {
    onChange({
      sections: [...config.sections, {
        id: newId(),
        name: 'custom',
        standalone: [],
        roleSlots: [],
      }],
    });
  };

  const resetToDefaults = () => {
    if (!confirm('Reset all semantic tokens to defaults? Custom tokens will be lost.')) return;
    onChange(DEFAULT_SEMANTIC_CONFIG);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fui-fg-neutral-primary)' }}>
            Semantic tokens
          </div>
          <div style={{ fontSize: 12, color: 'var(--fui-fg-neutral-secondary)', marginTop: 2 }}>
            Each role slot expands across every active role: brand, neutral, success, warning, danger, info{includeSecondary ? ', subbrand' : ''}.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button buttonType="tertiary" status="neutral" padSize="sm" textSize={12} onClick={resetToDefaults}>
            Reset to defaults
          </Button>
          <Button buttonType="secondary" status="neutral" padSize="sm" textSize={12} onClick={onExit}>
            Done
          </Button>
        </div>
      </div>

      {config.sections.map(section => (
        <SectionEditor
          key={section.id}
          section={section}
          onChange={(patch) => updateSection(section.id, patch)}
          onRemove={() => removeSection(section.id)}
          namingConfig={namingConfig}
          previewResult={previewResult}
          includeSecondary={includeSecondary}
        />
      ))}

      <Button buttonType="tertiary" status="neutral" padSize="md" textSize={14} onClick={addSection}>
        + Add section
      </Button>
    </div>
  );
}

// ---- Section ----

interface SectionEditorProps {
  section: SemanticSectionConfig;
  onChange: (patch: Partial<SemanticSectionConfig>) => void;
  onRemove: () => void;
  namingConfig: NamingConfig;
  previewResult: GenerationResult | null;
  includeSecondary: boolean;
}

function SectionEditor({ section, onChange, onRemove, namingConfig, previewResult, includeSecondary }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const updateStandalone = (id: string, patch: Partial<StandaloneToken>) => {
    onChange({ standalone: section.standalone.map(t => t.id === id ? { ...t, ...patch } : t) });
  };
  const removeStandalone = (id: string) => {
    onChange({ standalone: section.standalone.filter(t => t.id !== id) });
  };
  const addStandalone = () => {
    onChange({
      standalone: [
        ...section.standalone,
        { id: newId(), name: 'new-token', ref: 'gray.9' as PrimitiveRef },
      ],
    });
  };

  const updateSlot = (id: string, patch: Partial<RoleSlot>) => {
    onChange({ roleSlots: section.roleSlots.map(s => s.id === id ? { ...s, ...patch } : s) });
  };
  const removeSlot = (id: string) => {
    onChange({ roleSlots: section.roleSlots.filter(s => s.id !== id) });
  };
  const addSlot = () => {
    onChange({
      roleSlots: [
        ...section.roleSlots,
        { id: newId(), suffix: 'new', ref: '{role}.9' as PrimitiveRef },
      ],
    });
  };

  return (
    <div
      style={{
        borderRadius: 12,
        backgroundColor: 'var(--fui-bg-surface-1, var(--fui-neutral-2))',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: 24, height: 24, borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer',
            color: 'var(--fui-fg-neutral-secondary)', fontSize: 14,
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <div style={{ flex: '0 0 160px' }}>
          <TextInline
            value={section.name}
            onChange={(e) => onChange({ name: e.target.value })}
            padSize="sm"
            textSize={14}
            showLabel={false}
            showCaption={false}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--fui-fg-neutral-secondary)' }}>
          {section.standalone.length} standalone · {section.roleSlots.length} role slot{section.roleSlots.length === 1 ? '' : 's'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Button buttonType="tertiary" status="error" padSize="sm" textSize={12} onClick={onRemove}>
            Delete section
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Standalone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SubHeader>Standalone tokens</SubHeader>
            {section.standalone.length === 0 && <EmptyHint>No standalone tokens.</EmptyHint>}
            {section.standalone.map(tok => (
              <StandaloneRow
                key={tok.id}
                sectionName={section.name}
                token={tok}
                onChange={(p) => updateStandalone(tok.id, p)}
                onRemove={() => removeStandalone(tok.id)}
                previewResult={previewResult}
                includeSecondary={includeSecondary}
              />
            ))}
            <Button buttonType="tertiary" status="neutral" padSize="sm" textSize={12} onClick={addStandalone}>
              + Add standalone token
            </Button>
          </div>

          {/* Role slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SubHeader>Role-slot templates</SubHeader>
            {section.roleSlots.length === 0 && <EmptyHint>No role slots.</EmptyHint>}
            {section.roleSlots.map(slot => (
              <RoleSlotRow
                key={slot.id}
                sectionName={section.name}
                slot={slot}
                onChange={(p) => updateSlot(slot.id, p)}
                onRemove={() => removeSlot(slot.id)}
                namingConfig={namingConfig}
                previewResult={previewResult}
                includeSecondary={includeSecondary}
              />
            ))}
            <Button buttonType="tertiary" status="neutral" padSize="sm" textSize={12} onClick={addSlot}>
              + Add role slot
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: 'var(--fui-fg-neutral-secondary)',
      marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))', fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

// ---- Standalone row ----

interface StandaloneRowProps {
  sectionName: string;
  token: StandaloneToken;
  onChange: (patch: Partial<StandaloneToken>) => void;
  onRemove: () => void;
  previewResult: GenerationResult | null;
  includeSecondary: boolean;
}

function StandaloneRow({ sectionName, token, onChange, onRemove, previewResult, includeSecondary }: StandaloneRowProps) {
  const isPerTheme = typeof token.ref !== 'string';
  const refLight = typeof token.ref === 'string' ? token.ref : token.ref.light;
  const refDark = typeof token.ref === 'string' ? token.ref : token.ref.dark;

  const setRef = (ref: PrimitiveRef) => onChange({ ref });

  const togglePerTheme = () => {
    if (isPerTheme) {
      // collapse → keep light
      setRef(refLight);
    } else {
      setRef({ light: refLight, dark: refLight });
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px',
      borderRadius: 8,
      background: 'var(--fui-bg-surface-2, var(--fui-neutral-1))',
    }}>
      <span style={{ fontSize: 12, color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))', minWidth: 32 }}>
        {sectionName}/
      </span>
      <div style={{ flex: '0 0 160px' }}>
        <TextInline
          value={token.name}
          onChange={(e) => onChange({ name: e.target.value })}
          padSize="sm"
          textSize={12}
          showLabel={false}
          showCaption={false}
        />
      </div>

      {isPerTheme ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RefCol label="Light">
            <PrimitiveRefPicker
              mode="standalone"
              value={refLight}
              onChange={(v) => setRef({ light: v, dark: refDark })}
              previewResult={previewResult}
              includeSecondary={includeSecondary}
            />
          </RefCol>
          <RefCol label="Dark">
            <PrimitiveRefPicker
              mode="standalone"
              value={refDark}
              onChange={(v) => setRef({ light: refLight, dark: v })}
              previewResult={previewResult}
              includeSecondary={includeSecondary}
            />
          </RefCol>
        </div>
      ) : (
        <PrimitiveRefPicker
          mode="standalone"
          value={refLight}
          onChange={setRef}
          previewResult={previewResult}
          includeSecondary={includeSecondary}
        />
      )}

      <button
        type="button"
        onClick={togglePerTheme}
        title={isPerTheme ? 'Same ref for light & dark' : 'Different refs per theme'}
        style={{
          marginLeft: 'auto',
          height: 24, padding: '0 8px', borderRadius: 4,
          border: '1px solid var(--fui-border-neutral-secondary, rgba(0,0,0,0.15))',
          background: isPerTheme ? 'var(--fui-bg-accent-secondary, rgba(99,102,241,0.1))' : 'transparent',
          fontSize: 11, cursor: 'pointer',
          color: 'var(--fui-fg-neutral-primary)',
        }}
      >
        L/D
      </button>
      <Button buttonType="tertiary" status="error" padSize="sm" textSize={12} onClick={onRemove}>
        ×
      </Button>
    </div>
  );
}

function RefCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))',
      }}>{label}</span>
      {children}
    </div>
  );
}

// ---- Role slot row ----

interface RoleSlotRowProps {
  sectionName: string;
  slot: RoleSlot;
  onChange: (patch: Partial<RoleSlot>) => void;
  onRemove: () => void;
  namingConfig: NamingConfig;
  previewResult: GenerationResult | null;
  includeSecondary: boolean;
}

function RoleSlotRow({ sectionName, slot, onChange, onRemove, namingConfig, previewResult, includeSecondary }: RoleSlotRowProps) {
  const isPerTheme = typeof slot.ref !== 'string';
  const refLight = typeof slot.ref === 'string' ? slot.ref : slot.ref.light;
  const refDark = typeof slot.ref === 'string' ? slot.ref : slot.ref.dark;
  const setRef = (ref: PrimitiveRef) => onChange({ ref });

  const togglePerTheme = () => {
    if (isPerTheme) setRef(refLight);
    else setRef({ light: refLight, dark: refLight });
  };

  const roles: SemanticRole[] = SEMANTIC_ROLES.filter(r => r !== 'secondary' || includeSecondary);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px',
      borderRadius: 8,
      background: 'var(--fui-bg-surface-2, var(--fui-neutral-1))',
    }}>
      <span style={{ fontSize: 12, color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))', minWidth: 80 }}>
        {sectionName}/{'{role}'}-
      </span>
      <div style={{ flex: '0 0 140px' }}>
        <TextInline
          value={slot.suffix}
          onChange={(e) => onChange({ suffix: e.target.value })}
          padSize="sm"
          textSize={12}
          showLabel={false}
          showCaption={false}
        />
      </div>

      {isPerTheme ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RefCol label="Light">
            <PrimitiveRefPicker
              mode="slot"
              value={refLight}
              onChange={(v) => setRef({ light: v, dark: refDark })}
              previewResult={previewResult}
              previewRole="brand"
              includeSecondary={includeSecondary}
            />
          </RefCol>
          <RefCol label="Dark">
            <PrimitiveRefPicker
              mode="slot"
              value={refDark}
              onChange={(v) => setRef({ light: refLight, dark: v })}
              previewResult={previewResult}
              previewRole="brand"
              includeSecondary={includeSecondary}
            />
          </RefCol>
        </div>
      ) : (
        <PrimitiveRefPicker
          mode="slot"
          value={refLight}
          onChange={setRef}
          previewResult={previewResult}
          previewRole="brand"
          includeSecondary={includeSecondary}
        />
      )}

      <button
        type="button"
        onClick={togglePerTheme}
        title={isPerTheme ? 'Same ref for light & dark' : 'Different refs per theme'}
        style={{
          marginLeft: 'auto',
          height: 24, padding: '0 8px', borderRadius: 4,
          border: '1px solid var(--fui-border-neutral-secondary, rgba(0,0,0,0.15))',
          background: isPerTheme ? 'var(--fui-bg-accent-secondary, rgba(99,102,241,0.1))' : 'transparent',
          fontSize: 11, cursor: 'pointer',
          color: 'var(--fui-fg-neutral-primary)',
        }}
      >
        L/D
      </button>
      <Button buttonType="tertiary" status="error" padSize="sm" textSize={12} onClick={onRemove}>
        ×
      </Button>

      {/* Live preview: tiny swatch per role */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
        {roles.map(role => (
          <SlotPreviewSwatch
            key={role}
            role={role}
            slot={slot}
            previewResult={previewResult}
            namingConfig={namingConfig}
          />
        ))}
      </div>
    </div>
  );
}

function SlotPreviewSwatch({ role, slot, previewResult, namingConfig }: {
  role: SemanticRole;
  slot: RoleSlot;
  previewResult: GenerationResult | null;
  namingConfig: NamingConfig;
}) {
  const refStr = typeof slot.ref === 'string' ? slot.ref : slot.ref.light;
  // Substitute {role} with the internal scale name for this role.
  const scaleToRole: Record<string, SemanticRole> = {
    gray: 'neutral', accent: 'brand', secondary: 'secondary',
    green: 'success', amber: 'warning', red: 'danger', blue: 'info',
  };
  const roleToScale: Record<SemanticRole, string> = {} as Record<SemanticRole, string>;
  for (const [scale, r] of Object.entries(scaleToRole)) roleToScale[r] = scale;
  const scale = roleToScale[role];
  const expanded = refStr.replace(/\{role\}/g, scale);

  let color = 'transparent';
  if (previewResult) {
    const [s, stepRaw] = expanded.split('.');
    const isAlpha = stepRaw?.startsWith('a');
    const step = Number(isAlpha ? stepRaw.slice(1) : stepRaw);
    const targetRole = scaleToRole[s];
    if (targetRole) {
      if (isAlpha && previewResult.alphaPalette) {
        color = previewResult.alphaPalette[targetRole]?.[step as 1]?.css ?? 'transparent';
      } else {
        color = previewResult.palette[targetRole]?.[step as 1] ?? 'transparent';
      }
    }
  }

  return (
    <div
      title={`${namingConfig.roleNames[role]}-${slot.suffix}`}
      style={{
        width: 14, height: 14, borderRadius: 3,
        background: color === 'transparent'
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 6px 6px'
          : color,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
      }}
    />
  );
}
