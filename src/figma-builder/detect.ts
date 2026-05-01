// Detect existing 'primitives' / 'semantics' collections in the current Figma file.
// Used by sandbox/code.ts to decide between Create and Update flows.

import { PRIMITIVES, SEMANTICS } from './structure';

export interface DetectionResult {
  primitives: VariableCollection | null;
  semantics: VariableCollection | null;
}

export async function detectExistingCollections(): Promise<DetectionResult> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const find = (name: string) =>
    collections.find((c) => c.name === name) ?? null;
  return {
    primitives: find(PRIMITIVES),
    semantics: find(SEMANTICS),
  };
}
