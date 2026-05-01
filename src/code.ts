// Figma sandbox entry. Runs in main thread — has access to figma.* APIs but no DOM.
// All UI work happens in ui.tsx (iframe). Communication via postMessage.

import type { UIToSandbox, SandboxToUI } from './messages';
import { detectExistingCollections } from './figma-builder/detect';
import { createCollections, updateCollections, type KeyToId } from './figma-builder/apply';
import type { VariableStructure } from './figma-builder/structure';

const STATE_KEY = 'fui-plugin-state';
// Per-file map of stable spec key → Figma Variable.id. Lets us find existing
// variables by ID across syncs so renames are precise. Keyed by document root
// id (unique per file, stable across plugin runs).
const KEYMAP_KEY_PREFIX = 'fui-plugin-keymap:';
const FALLBACK_SIZE = { width: 560, height: 640 };

function keymapStorageKey(): string {
  return `${KEYMAP_KEY_PREFIX}${figma.root.id}`;
}

async function loadKeyToId(): Promise<KeyToId> {
  const saved = await figma.clientStorage.getAsync(keymapStorageKey());
  return saved && typeof saved === 'object' ? (saved as KeyToId) : {};
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
      postToUI({ type: 'sync-result', status: 'created' });
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
      const parts = [`${result.updated} updated`];
      if (result.created > 0) parts.push(`${result.created} created`);
      figma.notify(`Variables synced (${parts.join(', ')})`);
      postToUI({ type: 'sync-result', status: 'updated' });
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
    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;
  }
};
