// Editable semantic-token graph. Replaces the hard-coded SEMANTIC_TOKENS that
// used to live in figma-builder/structure.ts.
//
// Two flavors of tokens:
//  - Standalone:  fixed name + fixed primitive ref (e.g. `bg/canvas` → gray.0)
//  - Role slot:   template expanded across every active SemanticRole
//                 (e.g. slot `primary` step 9 alpha=false → `bg/brand-primary`,
//                 `bg/success-primary`, … for each role)
//
// PrimitiveRef syntax:
//   '<scale>.<step>'         solid step          ('gray.9', 'accent.0')
//   '<scale>.a<step>'        alpha step          ('gray.a3')
//   'black.a<step>'          theme-invariant     ('black.a8')
//   'white-fixed'            theme-invariant
//   '{role}.<step>' / '{role}.a<step>'   used ONLY in role-slot template;
//                                        the scale is filled in per role at
//                                        expansion time.
//
// Per-theme refs use { light, dark }.
//
// All `id` fields are stable UUIDs so rename detection works the same way it
// does for primitives (see figma-builder/apply.ts).

import type { SemanticRole } from './types';

export type PrimitiveRef = string | { light: string; dark: string };

export interface StandaloneToken {
  id: string;
  name: string;                 // e.g. 'canvas', 'surface-0', 'on-background'
  ref: PrimitiveRef;            // absolute ref (no {role} placeholder)
  description?: string;
}

export interface RoleSlot {
  id: string;
  suffix: string;               // e.g. 'primary', 'secondary-hover', 'tertiary'
  ref: PrimitiveRef;            // must use '{role}' placeholder
  description?: string;         // may contain {role} / {roleLabel}
}

export interface SemanticSectionConfig {
  id: string;
  name: string;                 // user-facing label: 'bg', 'fg', …
  standalone: StandaloneToken[];
  roleSlots: RoleSlot[];
}

export interface SemanticConfig {
  sections: SemanticSectionConfig[];
}

// Substitutes {role} into a role-slot ref. Used by structure.ts at expansion time.
export function applyRoleToRef(ref: PrimitiveRef, scaleName: string): PrimitiveRef {
  const sub = (s: string) => s.replace(/\{role\}/g, scaleName);
  return typeof ref === 'string' ? sub(ref) : { light: sub(ref.light), dark: sub(ref.dark) };
}

// Stable-but-deterministic IDs for the defaults. Real UUIDs are used at runtime
// when the user adds new tokens; here we hand-pick readable IDs so the default
// config diffs cleanly and round-trips through persistence without churn.
function did(s: string): string {
  return `def_${s}`;
}

// Internal scale names used in refs. These match the keys in structure.ts'
// ROLE_TO_SCALE table (gray/accent/green/amber/red/blue/secondary).
const ROLE_SCALES = {
  neutral: 'gray',
  brand: 'accent',
  secondary: 'secondary',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  info: 'blue',
} as const satisfies Record<SemanticRole, string>;

export function roleScaleName(role: SemanticRole): string {
  return ROLE_SCALES[role];
}

// Default configuration — mirrors the previous hard-coded SEMANTIC_TOKENS.
// Token-level descriptions are reproduced verbatim where they were unique.
// Role-slot descriptions use {roleLabel} which is substituted at expansion time
// (see figma-builder/structure.ts).
export const DEFAULT_SEMANTIC_CONFIG: SemanticConfig = {
  sections: [
    {
      id: did('bg'),
      name: 'bg',
      standalone: [
        {
          id: did('bg-canvas'),
          name: 'canvas',
          ref: 'gray.0',
          description: 'Page canvas — topmost surface, behind everything else.',
        },
        {
          id: did('bg-primary'),
          name: 'primary',
          ref: { light: 'gray.0', dark: 'gray.1' },
          description: 'Primary surface for cards, panels, and other content containers.',
        },
        {
          id: did('bg-secondary'),
          name: 'secondary',
          ref: { light: 'gray.1', dark: 'gray.0' },
          description: 'Recessed surface — sits below bg/primary for visual layering.',
        },
        {
          id: did('bg-surface-0'),
          name: 'surface-0',
          ref: { light: 'gray.1', dark: 'gray.a1' },
          description: 'Elevation level 0 — for stacked panels, menus, and popovers.',
        },
        {
          id: did('bg-surface-1'),
          name: 'surface-1',
          ref: { light: 'gray.0', dark: 'gray.1' },
          description: 'Elevation level 1 — for stacked panels, menus, and popovers.',
        },
        {
          id: did('bg-surface-2'),
          name: 'surface-2',
          ref: { light: 'gray.0', dark: 'gray.2' },
          description: 'Elevation level 2 — for stacked panels, menus, and popovers.',
        },
        {
          id: did('bg-surface-3'),
          name: 'surface-3',
          ref: { light: 'gray.0', dark: 'gray.3' },
          description: 'Elevation level 3 — for stacked panels, menus, and popovers.',
        },
        {
          id: did('bg-surface-4'),
          name: 'surface-4',
          ref: { light: 'gray.0', dark: 'gray.4' },
          description: 'Elevation level 4 — for stacked panels, menus, and popovers.',
        },
      ],
      roleSlots: [
        { id: did('bg-slot-primary'),         suffix: 'primary',         ref: '{role}.9',  description: 'Solid {roleLabel} surface — buttons, badges, active states.' },
        { id: did('bg-slot-primary-hover'),   suffix: 'primary-hover',   ref: '{role}.10', description: 'Hover state of bg/{roleLabel}-primary.' },
        { id: did('bg-slot-secondary'),       suffix: 'secondary',       ref: '{role}.a3', description: 'Subtle {roleLabel} surface — selected rows, ghost buttons, soft fills.' },
        { id: did('bg-slot-secondary-hover'), suffix: 'secondary-hover', ref: '{role}.a4', description: 'Hover state of bg/{roleLabel}-secondary.' },
      ],
    },
    {
      id: did('fg'),
      name: 'fg',
      standalone: [
        {
          id: did('fg-on-background'),
          name: 'on-background',
          ref: 'white-fixed',
          description: 'White text on saturated colored backgrounds (bg/*-primary).',
        },
        {
          id: did('fg-neutral-tertiary'),
          name: 'neutral-tertiary',
          ref: 'gray.a8',
          description: 'Tertiary text — placeholders, disabled, deeply muted copy.',
        },
      ],
      roleSlots: [
        { id: did('fg-slot-primary'),   suffix: 'primary',   ref: '{role}.12', description: 'Primary {roleLabel} text — emphasis.' },
        { id: did('fg-slot-secondary'), suffix: 'secondary', ref: '{role}.11', description: 'Secondary (muted) {roleLabel} text.' },
      ],
    },
    {
      id: did('border'),
      name: 'border',
      standalone: [],
      roleSlots: [
        { id: did('border-slot-primary'),         suffix: 'primary',         ref: '{role}.a9', description: 'Strongest {roleLabel} border — focus emphasis, key outlines.' },
        { id: did('border-slot-secondary'),       suffix: 'secondary',       ref: '{role}.a7', description: 'Default interactive {roleLabel} border — inputs, buttons.' },
        { id: did('border-slot-secondary-hover'), suffix: 'secondary-hover', ref: '{role}.a8', description: 'Hover state of border/{roleLabel}-secondary.' },
        { id: did('border-slot-tertiary'),        suffix: 'tertiary',        ref: '{role}.a6', description: 'Subtle {roleLabel} border — dividers, decorative separators.' },
      ],
    },
    {
      id: did('overlay'),
      name: 'overlay',
      standalone: [
        {
          id: did('overlay-scrim'),
          name: 'scrim',
          ref: { light: 'black.a8', dark: 'black.a9' },
          description: 'Backdrop behind modals and dialogs.',
        },
        {
          id: did('overlay-hover'),
          name: 'hover',
          ref: 'gray.a3',
          description: 'Translucent hover overlay on interactive elements.',
        },
        {
          id: did('overlay-active'),
          name: 'active',
          ref: 'gray.a4',
          description: 'Translucent pressed/active overlay on interactive elements.',
        },
      ],
      roleSlots: [],
    },
  ],
};

// Set of valid primitive scale names (used by the UI to populate dropdowns).
// 'secondary' is included; structure.ts will skip slots that resolve to the
// secondary scale when the secondary brand is disabled.
export const PRIMITIVE_SCALE_NAMES = [
  'gray',
  'accent',
  'secondary',
  'green',
  'amber',
  'red',
  'blue',
] as const;
export type PrimitiveScaleName = (typeof PRIMITIVE_SCALE_NAMES)[number];

// Cross-palette special scales (theme-invariant).
export const SPECIAL_REFS = ['white-fixed', 'black.a'] as const;
