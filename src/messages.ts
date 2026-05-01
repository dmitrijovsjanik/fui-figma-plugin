// Typed protocol shared between sandbox (code.ts) and UI (ui.tsx).
// Messages flow both ways via figma.ui.postMessage / parent.postMessage.

import type { PersistedState } from './ui/persistence-types';
import type { VariableStructure } from './figma-builder/structure';
import type { Orphan } from './figma-builder/apply';

// UI → sandbox
export type UIToSandbox =
  | { type: 'state-load' }
  | { type: 'state-save'; state: PersistedState }
  | {
      type: 'sync';
      structure: VariableStructure;
    }
  | { type: 'delete-orphans'; ids: string[] }
  | { type: 'resize'; width: number; height: number };

// Sandbox → UI
export type SandboxToUI =
  | { type: 'state-hydrate'; state: PersistedState | null }
  | {
      type: 'sync-result';
      status: 'created' | 'updated' | 'inconsistent' | 'error';
      message?: string;
      orphans?: Orphan[];
    }
  | { type: 'orphans-deleted'; count: number };
