// Figma sandbox entry. Runs in main thread — has access to figma.* APIs but no DOM.
// All UI work happens in ui.tsx (iframe). Communication via postMessage.

import type { UIToSandbox, SandboxToUI } from './messages';
import { detectExistingCollections } from './figma-builder/detect';
import { createCollections, updateCollections, deleteVariablesByIds, type KeyToId } from './figma-builder/apply';
import type { VariableStructure } from './figma-builder/structure';

const STATE_KEY = 'fui-plugin-state';
// Per-file map of stable spec key → Figma Variable.id. Lets us find existing
// variables by ID across syncs so renames are precise. Keyed by document root
// id (unique per file, stable across plugin runs).
const KEYMAP_KEY_PREFIX = 'fui-plugin-keymap:';
const FALLBACK_SIZE = { width: 560, height: 640 };

// Old → new spec keys. Applied on load so renamed semantic tokens still resolve
// to the same Figma variable instead of triggering a fresh create + orphan.
// Add an entry whenever a token is renamed in SEMANTIC_TOKENS.
const KEY_MIGRATIONS: Record<string, string> = {
  'sem:bg:component': 'sem:bg:neutral',
  'sem:bg:component-hover': 'sem:bg:neutral-hover',
  // fg restructure: neutral text gets the neutral- prefix; per-color text
  // splits into primary (step 12) / secondary (step 11). Old single tokens
  // mapped to step 11, so they migrate to <color>-secondary.
  'sem:fg:primary': 'sem:fg:neutral-primary',
  'sem:fg:secondary': 'sem:fg:neutral-secondary',
  'sem:fg:tertiary': 'sem:fg:neutral-tertiary',
  'sem:fg:accent': 'sem:fg:accent-secondary',
  'sem:fg:success': 'sem:fg:success-secondary',
  'sem:fg:warning': 'sem:fg:warning-secondary',
  'sem:fg:danger': 'sem:fg:danger-secondary',
  'sem:fg:info': 'sem:fg:info-secondary',
};

function keymapStorageKey(): string {
  return `${KEYMAP_KEY_PREFIX}${figma.root.id}`;
}

async function loadKeyToId(): Promise<KeyToId> {
  const saved = await figma.clientStorage.getAsync(keymapStorageKey());
  if (!saved || typeof saved !== 'object') return {};
  const raw = saved as KeyToId;
  const migrated: KeyToId = {};
  for (const [k, v] of Object.entries(raw)) {
    migrated[KEY_MIGRATIONS[k] ?? k] = v;
  }
  return migrated;
}

async function saveKeyToId(map: KeyToId): Promise<void> {
  await figma.clientStorage.setAsync(keymapStorageKey(), map);
}

// Restore last saved size synchronously-ish: read clientStorage on boot, then
// resize the window if a saved size exists. Until then, open with FALLBACK_SIZE.
figma.showUI(__html__, { width: FALLBACK_SIZE.width, height: FALLBACK_SIZE.height, themeColors: true });
void (async () => {
  const saved = await figma.clientStorage.getAsync(STATE_KEY);
  const size = saved?.windowSize;
  if (size && typeof size.width === 'number' && typeof size.height === 'number') {
    figma.ui.resize(size.width, size.height);
  }
})();

function postToUI(msg: SandboxToUI): void {
  figma.ui.postMessage(msg);
}

async function handleStateLoad(): Promise<void> {
  const state = await figma.clientStorage.getAsync(STATE_KEY);
  postToUI({ type: 'state-hydrate', state: state ?? null });
}

async function handleStateSave(state: unknown): Promise<void> {
  await figma.clientStorage.setAsync(STATE_KEY, state);
}

async function handleSync(payload: {
  structure: VariableStructure;
}): Promise<void> {
  try {
    const existing = await detectExistingCollections();
    const hasPrim = existing.primitives !== null;
    const hasSem = existing.semantics !== null;

    if (!hasPrim && !hasSem) {
      const result = await createCollections(payload.structure);
      await saveKeyToId(result.keyToId);
      figma.notify('Variables created');
      postToUI({ type: 'sync-result', status: 'created', orphans: result.orphans });
      return;
    }

    if (hasPrim && hasSem) {
      const previousKeyToId = await loadKeyToId();
      const result = await updateCollections(payload.structure, {
        primitivesCollection: existing.primitives!,
        semanticsCollection: existing.semantics!,
        previousKeyToId,
      });
      await saveKeyToId(result.keyToId);
      if (result.updated === 0 && result.created === 0) {
        figma.notify('Variables already up to date');
      } else {
        const parts = [`${result.updated} updated`];
        if (result.created > 0) parts.push(`${result.created} created`);
        figma.notify(`Variables synced (${parts.join(', ')})`);
      }
      postToUI({ type: 'sync-result', status: 'updated', orphans: result.orphans });
      return;
    }

    // Mixed state — only one of two collections exists
    const message = `Inconsistent state: only "${hasPrim ? 'primitives' : 'semantics'}" exists. Delete it or create the other manually before syncing.`;
    figma.notify(message, { error: true });
    postToUI({ type: 'sync-result', status: 'inconsistent', message });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    figma.notify(`Sync failed: ${message}`, { error: true });
    postToUI({ type: 'sync-result', status: 'error', message });
  }
}

async function handleDeleteOrphans(ids: string[]): Promise<void> {
  const count = await deleteVariablesByIds(ids);
  if (count > 0) figma.notify(`Removed ${count} unused variable${count === 1 ? '' : 's'}`);
  postToUI({ type: 'orphans-deleted', count });
}

figma.ui.onmessage = (msg: UIToSandbox) => {
  switch (msg.type) {
    case 'state-load':
      void handleStateLoad();
      break;
    case 'state-save':
      void handleStateSave(msg.state);
      break;
    case 'sync':
      void handleSync(msg);
      break;
    case 'delete-orphans':
      void handleDeleteOrphans(msg.ids);
      break;
    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;
  }
};
