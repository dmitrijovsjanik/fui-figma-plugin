// Materialize a VariableStructure into Figma via the figma.variables.* API.
// Two entry points:
//   - createCollections: full creation when no existing collections match.
//   - updateCollections: precise rename + value update when both collections already exist.
//
// Both flows return a KeyToId map (stable spec.key → Figma Variable.id) that the
// caller persists in clientStorage. On the next sync this map lets us find the
// exact existing Figma variable for each spec — independent of its current name —
// so renames are exact and structural changes don't cause spurious recreations.

import type { VariableStructure, RGBA } from './structure';
import { PRIMITIVES, SEMANTICS } from './structure';

const COLOR_TYPE = 'COLOR' as const;

export type KeyToId = Record<string, string>;

export interface Orphan {
  id: string;
  name: string;
  collection: 'primitives' | 'semantics';
}

export interface ApplyResult {
  keyToId: KeyToId;
  created: number;
  updated: number;
  // Variables that exist in our collections but are not produced by any current
  // spec. Empty after createCollections (everything is fresh). Populated by
  // updateCollections when the user has stale tokens from a prior version.
  orphans: Orphan[];
}

function pathToName(path: string[]): string {
  return path.join('/');
}

// === Create flow ===

export async function createCollections(structure: VariableStructure): Promise<ApplyResult> {
  const keyToId: KeyToId = {};
  let created = 0;

  // Phase 1 — primitives.
  const primCollection = figma.variables.createVariableCollection(structure.primitives.name);
  const primDefaultModeId = primCollection.modes[0].modeId;
  primCollection.renameMode(primDefaultModeId, structure.primitives.modes[0]);
  const primModeMap: Record<string, string> = { [structure.primitives.modes[0]]: primDefaultModeId };

  const primVarsByPath = new Map<string, Variable>();
  for (const spec of structure.primitives.variables) {
    const v = figma.variables.createVariable(pathToName(spec.path), primCollection, COLOR_TYPE);
    primVarsByPath.set(pathToName(spec.path), v);
    keyToId[spec.key] = v.id;
    created++;
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = primModeMap[modeName];
      if (!modeId) continue;
      v.setValueForMode(modeId, value as RGBA);
    }
  }

  // Phase 2 — semantics. Two modes (Light, Dark). Aliases reference primitives.
  const semCollection = figma.variables.createVariableCollection(structure.semantics.name);
  const firstSemModeId = semCollection.modes[0].modeId;
  semCollection.renameMode(firstSemModeId, structure.semantics.modes[0]);
  const secondSemModeId = semCollection.addMode(structure.semantics.modes[1]);
  const semModeMap: Record<string, string> = {
    [structure.semantics.modes[0]]: firstSemModeId,
    [structure.semantics.modes[1]]: secondSemModeId,
  };

  for (const spec of structure.semantics.variables) {
    const v = figma.variables.createVariable(pathToName(spec.path), semCollection, COLOR_TYPE);
    keyToId[spec.key] = v.id;
    created++;
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = semModeMap[modeName];
      if (!modeId) continue;
      if ('aliasOf' in (value as object)) {
        const ref = value as { aliasOf: { collection: string; path: string[] } };
        const target = primVarsByPath.get(pathToName(ref.aliasOf.path));
        if (target) {
          v.setValueForMode(modeId, figma.variables.createVariableAlias(target));
        }
        // If not found, leave the variable's value unset — Figma shows "—".
        // Should not happen if structure is consistent.
      } else {
        v.setValueForMode(modeId, value as RGBA);
      }
    }
  }

  return { keyToId, created, updated: 0, orphans: [] };
}

// === Update flow ===

interface UpdateContext {
  primitivesCollection: VariableCollection;
  semanticsCollection: VariableCollection;
  // key → Figma Variable.id from the last successful sync. Empty on first sync
  // after upgrade (we'll fall back to name-matching to adopt existing variables).
  previousKeyToId: KeyToId;
}

// Find an existing Figma variable for a spec.
// Priority: stable-key ID lookup → current-name lookup → null (caller creates).
async function findExisting(
  spec: { key: string; path: string[] },
  collection: VariableCollection,
  previousKeyToId: KeyToId,
  byName: Map<string, Variable>,
  claimedIds: Set<string>,
): Promise<Variable | null> {
  const previousId = previousKeyToId[spec.key];
  if (previousId && !claimedIds.has(previousId)) {
    const v = await figma.variables.getVariableByIdAsync(previousId);
    // Verify it still belongs to the expected collection (user may have moved/deleted it).
    if (v && v.variableCollectionId === collection.id) {
      claimedIds.add(previousId);
      return v;
    }
  }
  // Fallback: name match. Useful for the first sync after upgrading to the
  // key-based system, when previousKeyToId is empty but variables exist.
  const targetName = pathToName(spec.path);
  const byNameMatch = byName.get(targetName);
  if (byNameMatch && !claimedIds.has(byNameMatch.id)) {
    claimedIds.add(byNameMatch.id);
    return byNameMatch;
  }
  return null;
}

export async function updateCollections(
  structure: VariableStructure,
  ctx: UpdateContext,
): Promise<ApplyResult> {
  const keyToId: KeyToId = {};
  let updated = 0;
  let created = 0;
  const claimedIds = new Set<string>();

  // ---- Primitives ----
  const primVars = await Promise.all(
    ctx.primitivesCollection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
  );
  const primByName = new Map<string, Variable>();
  for (const v of primVars) if (v) primByName.set(v.name, v);

  const primModeId = ctx.primitivesCollection.modes[0].modeId;

  // Built during the loop — current-path → variable. Used by semantic alias
  // resolution below; includes newly-created primitives, unlike a map from
  // pre-rename names.
  const primByCurrentPath = new Map<string, Variable>();

  for (const spec of structure.primitives.variables) {
    const targetName = pathToName(spec.path);
    let existing = await findExisting(spec, ctx.primitivesCollection, ctx.previousKeyToId, primByName, claimedIds);
    let didCreate = false;
    if (!existing) {
      existing = figma.variables.createVariable(targetName, ctx.primitivesCollection, COLOR_TYPE);
      claimedIds.add(existing.id);
      didCreate = true;
    } else if (existing.name !== targetName) {
      existing.name = targetName;
    }
    keyToId[spec.key] = existing.id;
    primByCurrentPath.set(targetName, existing);
    const value = spec.valuesByMode[structure.primitives.modes[0]];
    if (value && !('aliasOf' in (value as object))) {
      existing.setValueForMode(primModeId, value as RGBA);
      if (didCreate) created++; else updated++;
    }
  }

  // ---- Semantics ----
  const semVars = await Promise.all(
    ctx.semanticsCollection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
  );
  const semByName = new Map<string, Variable>();
  for (const v of semVars) if (v) semByName.set(v.name, v);

  const semModeMap: Record<string, string> = {};
  for (const m of ctx.semanticsCollection.modes) {
    semModeMap[m.name] = m.modeId;
  }
  for (const requiredMode of structure.semantics.modes) {
    if (!semModeMap[requiredMode]) {
      semModeMap[requiredMode] = ctx.semanticsCollection.addMode(requiredMode);
    }
  }

  for (const spec of structure.semantics.variables) {
    const targetName = pathToName(spec.path);
    let existing = await findExisting(spec, ctx.semanticsCollection, ctx.previousKeyToId, semByName, claimedIds);
    let didCreate = false;
    if (!existing) {
      existing = figma.variables.createVariable(targetName, ctx.semanticsCollection, COLOR_TYPE);
      claimedIds.add(existing.id);
      didCreate = true;
    } else if (existing.name !== targetName) {
      existing.name = targetName;
    }
    keyToId[spec.key] = existing.id;
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = semModeMap[modeName];
      if (!modeId) continue;
      if ('aliasOf' in (value as object)) {
        const ref = value as { aliasOf: { collection: string; path: string[] } };
        const target = primByCurrentPath.get(pathToName(ref.aliasOf.path));
        if (target) {
          existing.setValueForMode(modeId, figma.variables.createVariableAlias(target));
        }
      } else {
        existing.setValueForMode(modeId, value as RGBA);
      }
    }
    if (didCreate) created++; else updated++;
  }

  // Anything we never claimed = orphan. User-created variables in our collections
  // get caught here too, but the modal makes deletion opt-in per row.
  const orphans: Orphan[] = [];
  for (const v of primVars) {
    if (v && !claimedIds.has(v.id)) {
      orphans.push({ id: v.id, name: v.name, collection: 'primitives' });
    }
  }
  for (const v of semVars) {
    if (v && !claimedIds.has(v.id)) {
      orphans.push({ id: v.id, name: v.name, collection: 'semantics' });
    }
  }

  return { keyToId, created, updated, orphans };
}

// Delete a set of variables by ID. Used by the post-sync orphan cleanup modal.
// Returns the count of successful deletions.
export async function deleteVariablesByIds(ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) {
      v.remove();
      deleted++;
    }
  }
  return deleted;
}

// Re-exports for ergonomic import
export { PRIMITIVES, SEMANTICS };
export type { CollectionSpec } from './structure';
