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
  lightResult: GenerationResult | null;
  darkResult: GenerationResult | null;
  includeSecondary: boolean;
  onExit: () => void;
}

export function SemanticTokensEditor({
  config,
  onChange,
  namingConfig,
  lightResult,
  darkResult,
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
          lightResult={lightResult}
          darkResult={darkResult}
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
  lightResult: GenerationResult | null;
  darkResult: GenerationResult | null;
  includeSecondary: boolean;
}

function SectionEditor({ section, onChange, onRemove, namingConfig, lightResult, darkResult, includeSecondary }: SectionEditorProps) {
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
        { id: newId(), name: 'new-token', ref: { light: 'gray.9', dark: 'gray.9' } },
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
        { id: newId(), suffix: 'new', ref: { light: '{role}.9', dark: '{role}.9' } },
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
          <GroupPanel title="Standalone tokens">
            <ColumnHeaders nameLabel="Name" />
            {section.standalone.length === 0 && (
              <EmptyRow>No standalone tokens.</EmptyRow>
            )}
            {section.standalone.map(tok => (
              <StandaloneRow
                key={tok.id}
                sectionName={section.name}
                token={tok}
                onChange={(p) => updateStandalone(tok.id, p)}
                onRemove={() => removeStandalone(tok.id)}
                lightResult={lightResult}
                darkResult={darkResult}
                includeSecondary={includeSecondary}
              />
            ))}
            <div style={{
              padding: '6px 8px',
              borderTop: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.06))',
            }}>
              <Button buttonType="tertiary" status="neutral" padSize="sm" textSize={12} onClick={addStandalone}>
                + Add standalone token
              </Button>
            </div>
          </GroupPanel>

          <GroupPanel title="Role-slot templates">
            <ColumnHeaders nameLabel="Suffix" />
            {section.roleSlots.length === 0 && (
              <EmptyRow>No role slots.</EmptyRow>
            )}
            {section.roleSlots.map(slot => (
              <RoleSlotRow
                key={slot.id}
                sectionName={section.name}
                slot={slot}
                onChange={(p) => updateSlot(slot.id, p)}
                onRemove={() => removeSlot(slot.id)}
                namingConfig={namingConfig}
                lightResult={lightResult}
                darkResult={darkResult}
                includeSecondary={includeSecondary}
              />
            ))}
            <div style={{
              padding: '6px 8px',
              borderTop: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.06))',
            }}>
              <Button buttonType="tertiary" status="neutral" padSize="sm" textSize={12} onClick={addSlot}>
                + Add role slot
              </Button>
            </div>
          </GroupPanel>
        </>
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px',
      fontSize: 12,
      color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))',
      fontStyle: 'italic',
      borderTop: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.06))',
    }}>
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
  lightResult: GenerationResult | null;
  darkResult: GenerationResult | null;
  includeSecondary: boolean;
}

function StandaloneRow({ sectionName, token, onChange, onRemove, lightResult, darkResult, includeSecondary }: StandaloneRowProps) {
  const { light, dark } = token.ref;
  const setRef = (ref: PrimitiveRef) => onChange({ ref });

  return (
    <TokenRow
      prefix={`${sectionName}/`}
      nameValue={token.name}
      onNameChange={(v) => onChange({ name: v })}
      lightPicker={
        <PrimitiveRefPicker
          mode="standalone"
          value={light}
          onChange={(v) => setRef({ light: v, dark })}
          previewResult={lightResult}
          includeSecondary={includeSecondary}
        />
      }
      darkPicker={
        <PrimitiveRefPicker
          mode="standalone"
          value={dark}
          onChange={(v) => setRef({ light, dark: v })}
          previewResult={darkResult}
          includeSecondary={includeSecondary}
        />
      }
      onRemove={onRemove}
    />
  );
}

// One shared column model for every token row across both groups (Standalone
// and Role-slot). Keeping these widths in one place is what makes the editor
// visually a table — column positions stay identical regardless of group or
// whether an individual row is per-theme.
const COL = {
  prefix: 90,        // 'bg/' or 'bg/{role}-'
  name: 200,         // name / suffix input
  ref: 230,          // single Light or Dark picker
  actions: 40,       // delete button
  gap: 8,            // gap inside a column (e.g. between scale + step picker)
  colGap: 24,        // gap between distinct columns — emphasises Light vs Dark
} as const;

// Spacer placed between two visually-separate columns. Wider than the inner
// gap so the user can immediately tell Light ends and Dark begins.
function ColGap() {
  return <div style={{ width: COL.colGap - COL.gap, flexShrink: 0 }} />;
}

function Cell({ width, children, align = 'flex-start' }: {
  width: number;
  children?: React.ReactNode;
  align?: React.CSSProperties['justifyContent'];
}) {
  return (
    <div style={{
      width,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: align,
    }}>
      {children}
    </div>
  );
}

// Column header row — always shows "Light" + "Dark" columns regardless of how
// many rows are per-theme. That way Dark stays in the same x position when the
// user toggles L/D on individual rows.
function ColumnHeaders({ nameLabel }: { nameLabel: string }) {
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))',
  };
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: COL.gap,
      padding: '4px 8px',
      borderBottom: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.08))',
    }}>
      <Cell width={COL.prefix}><span style={labelStyle}>Path</span></Cell>
      <Cell width={COL.name}><span style={labelStyle}>{nameLabel}</span></Cell>
      <ColGap />
      <Cell width={COL.ref}><span style={labelStyle}>Light</span></Cell>
      <ColGap />
      <Cell width={COL.ref}><span style={labelStyle}>Dark</span></Cell>
      <Cell width={COL.actions} align="flex-end"><span style={labelStyle}>&nbsp;</span></Cell>
    </div>
  );
}

// Single token row using the shared column model. Used by both Standalone and
// Role-slot rows so column positions stay identical.
function TokenRow(props: {
  prefix: string;
  nameValue: string;
  onNameChange: (v: string) => void;
  lightPicker: React.ReactNode;
  darkPicker: React.ReactNode;
  onRemove: () => void;
  trailing?: React.ReactNode;
}) {
  const { prefix, nameValue, onNameChange, lightPicker, darkPicker, onRemove, trailing } = props;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: COL.gap,
      padding: '6px 8px',
      borderTop: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.06))',
    }}>
      <Cell width={COL.prefix}>
        <span style={{
          fontSize: 12,
          color: 'var(--fui-fg-neutral-tertiary, var(--fui-neutral-8))',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{prefix}</span>
      </Cell>
      <Cell width={COL.name}>
        <div style={{ width: '100%' }}>
          <TextInline
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            padSize="sm"
            textSize={12}
            showLabel={false}
            showCaption={false}
          />
        </div>
      </Cell>
      <ColGap />
      <Cell width={COL.ref}>{lightPicker}</Cell>
      <ColGap />
      <Cell width={COL.ref}>{darkPicker}</Cell>
      <Cell width={COL.actions} align="flex-end">
        <Button buttonType="tertiary" status="error" padSize="sm" textSize={12} onClick={onRemove}>×</Button>
      </Cell>
      {trailing}
    </div>
  );
}

// Group panel — a labelled, bordered container for one logical group of tokens
// (Standalone or Role-slot templates).
function GroupPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 10,
      border: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.1))',
      background: 'var(--fui-bg-surface-2, var(--fui-neutral-1))',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'var(--fui-fg-neutral-secondary)',
        background: 'var(--fui-bg-surface-1, var(--fui-neutral-2))',
        borderBottom: '1px solid var(--fui-border-neutral-tertiary, rgba(0,0,0,0.08))',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
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
  lightResult: GenerationResult | null;
  darkResult: GenerationResult | null;
  includeSecondary: boolean;
}

function RoleSlotRow({ sectionName, slot, onChange, onRemove, namingConfig, lightResult, darkResult, includeSecondary }: RoleSlotRowProps) {
  const { light, dark } = slot.ref;
  const setRef = (ref: PrimitiveRef) => onChange({ ref });

  const roles: SemanticRole[] = SEMANTIC_ROLES.filter(r => r !== 'secondary' || includeSecondary);

  return (
    <TokenRow
      prefix={`${sectionName}/{role}-`}
      nameValue={slot.suffix}
      onNameChange={(v) => onChange({ suffix: v })}
      lightPicker={
        <PrimitiveRefPicker
          mode="slot"
          value={light}
          onChange={(v) => setRef({ light: v, dark })}
          previewResult={lightResult}
          previewRole="brand"
          includeSecondary={includeSecondary}
        />
      }
      darkPicker={
        <PrimitiveRefPicker
          mode="slot"
          value={dark}
          onChange={(v) => setRef({ light, dark: v })}
          previewResult={darkResult}
          previewRole="brand"
          includeSecondary={includeSecondary}
        />
      }
      onRemove={onRemove}
      trailing={
        <div style={{ display: 'flex', gap: 2, paddingLeft: COL.gap }}>
          {roles.map(role => (
            <SlotPreviewSwatch
              key={role}
              role={role}
              slot={slot}
              previewResult={lightResult}
              namingConfig={namingConfig}
            />
          ))}
        </div>
      }
    />
  );
}

function SlotPreviewSwatch({ role, slot, previewResult, namingConfig }: {
  role: SemanticRole;
  slot: RoleSlot;
  previewResult: GenerationResult | null;
  namingConfig: NamingConfig;
}) {
  const refStr = slot.ref.light;
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
        width: 14, height: 14, borderRadius: '50%',
        background: color === 'transparent'
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 6px 6px'
          : color,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
      }}
    />
  );
}
