// Bridge between UI (React) and sandbox (figma.clientStorage) for state persistence.
// UI calls loadState() on mount → posts 'state-load' to sandbox → awaits 'state-hydrate'.
// UI calls saveState(state) on every change → posts 'state-save' to sandbox (debounced).

import type { UIToSandbox, SandboxToUI } from '../messages';
import type { PersistedState } from './persistence-types';

export function postToSandbox(msg: UIToSandbox): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

export function loadStateAsync(): Promise<PersistedState | null> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as SandboxToUI | undefined;
      if (msg?.type === 'state-hydrate') {
        window.removeEventListener('message', handler);
        resolve(msg.state as PersistedState | null);
      }
    };
    window.addEventListener('message', handler);
    postToSandbox({ type: 'state-load' });
  });
}

let saveTimer: number | undefined;
export function saveStateDebounced(state: PersistedState, delayMs = 200): void {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    postToSandbox({ type: 'state-save', state });
  }, delayMs);
}
