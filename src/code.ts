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
  // bg/component → bg/neutral (legacy)
  'sem:bg:component': 'sem:bg:neutral-primary',
  'sem:bg:component-hover': 'sem:bg:neutral-primary-hover',
  // bg restructure: <color>/<color>-hover/<color>-subtle/<color>-subtle-hover
  // → <color>-primary/<color>-primary-hover/<color>-secondary/<color>-secondary-hover.
  'sem:bg:neutral': 'sem:bg:neutral-primary',
  'sem:bg:neutral-hover': 'sem:bg:neutral-primary-hover',
  'sem:bg:neutral-subtle': 'sem:bg:neutral-secondary',
  'sem:bg:neutral-subtle-hover': 'sem:bg:neutral-secondary-hover',
  'sem:bg:accent': 'sem:bg:accent-primary',
  'sem:bg:accent-hover': 'sem:bg:accent-primary-hover',
  'sem:bg:accent-subtle': 'sem:bg:accent-secondary',
  'sem:bg:accent-subtle-hover': 'sem:bg:accent-secondary-hover',
  'sem:bg:success': 'sem:bg:success-primary',
  'sem:bg:success-hover': 'sem:bg:success-primary-hover',
  'sem:bg:success-subtle': 'sem:bg:success-secondary',
  'sem:bg:success-subtle-hover': 'sem:bg:success-secondary-hover',
  'sem:bg:warning': 'sem:bg:warning-primary',
  'sem:bg:warning-hover': 'sem:bg:warning-primary-hover',
  'sem:bg:warning-subtle': 'sem:bg:warning-secondary',
  'sem:bg:warning-subtle-hover': 'sem:bg:warning-secondary-hover',
  'sem:bg:danger': 'sem:bg:danger-primary',
  'sem:bg:danger-hover': 'sem:bg:danger-primary-hover',
  'sem:bg:danger-subtle': 'sem:bg:danger-secondary',
  'sem:bg:danger-subtle-hover': 'sem:bg:danger-secondary-hover',
  'sem:bg:info': 'sem:bg:info-primary',
  'sem:bg:info-hover': 'sem:bg:info-primary-hover',
  'sem:bg:info-subtle': 'sem:bg:info-secondary',
  'sem:bg:info-subtle-hover': 'sem:bg:info-secondary-hover',
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
  // on-* consolidation: a single fg/on-background replaces per-color on-*
  // tokens. Pin the migration to on-accent so its variable becomes
  // on-background; the other on-* variables surface as orphans for cleanup.
  'sem:fg:on-accent': 'sem:fg:on-background',
  // fg/link and fg/link-hover removed (duplicate of info-secondary/info-primary).
  // No migration: info-* already exist with the same values, so link variables
  // surface as orphans for the cleanup modal.
  // border restructure → primary/secondary/tertiary scheme.
  //   primary = a9 (no hover)
  //   secondary = a7 (default) + a8 (hover)
  //   tertiary = a6 (no hover)
  // Migrations cover both legacy keys (default/strong) and the brief
  // <color>/<color>-strong era so existing variables get renamed in place.
  // Pre-strong era (very old):
  'sem:border:default': 'sem:border:neutral-tertiary',           // a6
  'sem:border:strong': 'sem:border:neutral-secondary',           // a7
  'sem:border:strong-hover': 'sem:border:neutral-secondary-hover', // a8
  // Strong era — assumes the most recent state (post-81a2954) where bare
  // <color> meant the static a6 base. Users who skipped that sync see a
  // value shift on their colored borders; one extra resync settles it.
  'sem:border:neutral': 'sem:border:neutral-tertiary',
  'sem:border:neutral-strong': 'sem:border:neutral-secondary',
  'sem:border:neutral-strong-hover': 'sem:border:neutral-secondary-hover',
  'sem:border:accent': 'sem:border:accent-tertiary',
  'sem:border:accent-strong': 'sem:border:accent-secondary',
  'sem:border:accent-strong-hover': 'sem:border:accent-secondary-hover',
  'sem:border:success': 'sem:border:success-tertiary',
  'sem:border:success-strong': 'sem:border:success-secondary',
  'sem:border:success-strong-hover': 'sem:border:success-secondary-hover',
  'sem:border:warning': 'sem:border:warning-tertiary',
  'sem:border:warning-strong': 'sem:border:warning-secondary',
  'sem:border:warning-strong-hover': 'sem:border:warning-secondary-hover',
  'sem:border:danger': 'sem:border:danger-tertiary',
  'sem:border:danger-strong': 'sem:border:danger-secondary',
  'sem:border:danger-strong-hover': 'sem:border:danger-secondary-hover',
  'sem:border:info': 'sem:border:info-tertiary',
  'sem:border:info-strong': 'sem:border:info-secondary',
  'sem:border:info-strong-hover': 'sem:border:info-secondary-hover',
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
