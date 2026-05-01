// Materialize a VariableStructure into Figma via the figma.variables.* API.
// Two entry points:
//   - createCollections: full creation when no existing collections match.
//   - updateCollections: rename + value update when both collections already exist.

import type { CollectionSpec, VariableSpec, VariableStructure, RGBA } from './structure';
import { PRIMITIVES, SEMANTICS } from './structure';

const COLOR_TYPE = 'COLOR' as const;

function pathToName(path: string[]): string {
  return path.join('/');
}

// === Create flow ===

export async function createCollections(structure: VariableStructure): Promise<void> {
  // Phase 1 — primitives. Create all variables, build name → Variable map.
  const primCollection = figma.variables.createVariableCollection(structure.primitives.name);
  const primDefaultModeId = primCollection.modes[0].modeId;
  // Rename the auto-created mode to match the spec
  primCollection.renameMode(primDefaultModeId, structure.primitives.modes[0]);
  const primModeMap: Record<string, string> = { [structure.primitives.modes[0]]: primDefaultModeId };

  const primVarsByPath = new Map<string, Variable>();
  for (const spec of structure.primitives.variables) {
    const v = figma.variables.createVariable(pathToName(spec.path), primCollection, COLOR_TYPE);
    primVarsByPath.set(pathToName(spec.path), v);
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = primModeMap[modeName];
      if (!modeId) continue;
      v.setValueForMode(modeId, value as RGBA);
    }
  }

  // Phase 2 — semantics. Two modes (Light, Dark). Aliases reference primitives.
  const semCollection = figma.variables.createVariableCollection(structure.semantics.name);
  // Rename first auto-mode + add second
  const firstSemModeId = semCollection.modes[0].modeId;
  semCollection.renameMode(firstSemModeId, structure.semantics.modes[0]);
  const secondSemModeId = semCollection.addMode(structure.semantics.modes[1]);
  const semModeMap: Record<string, string> = {
    [structure.semantics.modes[0]]: firstSemModeId,
    [structure.semantics.modes[1]]: secondSemModeId,
  };

  for (const spec of structure.semantics.variables) {
    const v = figma.variables.createVariable(pathToName(spec.path), semCollection, COLOR_TYPE);
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = semModeMap[modeName];
      if (!modeId) continue;
      if ('aliasOf' in (value as object)) {
        const ref = value as { aliasOf: { collection: string; path: string[] } };
        const target = primVarsByPath.get(pathToName(ref.aliasOf.path));
        if (target) {
          v.setValueForMode(modeId, figma.variables.createVariableAlias(target));
        }
        // If not found, leave the variable's value unset for that mode — Figma will
        // show "—" in that cell. Should not happen if structure is consistent.
      } else {
        v.setValueForMode(modeId, value as RGBA);
      }
    }
  }
}

// === Update flow ===

interface UpdateContext {
  primitivesCollection: VariableCollection;
  semanticsCollection: VariableCollection;
  // Previously-applied structure (last successful sync). Used to find existing
  // variables by their previous path so we can rename + update them.
  previousStructure: VariableStructure | null;
}

export async function updateCollections(
  structure: VariableStructure,
  ctx: UpdateContext,
): Promise<{ updated: number; missing: number }> {
  let updated = 0;
  let missing = 0;

  // ---- Primitives ----
  const primVars = await Promise.all(
    ctx.primitivesCollection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
  );
  const primByName = new Map<string, Variable>();
  for (const v of primVars) if (v) primByName.set(v.name, v);

  // Map primary mode name → modeId (collections always have ≥1 mode)
  const primModeId = ctx.primitivesCollection.modes[0].modeId;

  // Build previous-name → spec lookup (if previous structure provided)
  const previousByCurrentIndex = new Map<number, VariableSpec>();
  if (ctx.previousStructure) {
    structure.primitives.variables.forEach((spec, i) => {
      const prev = ctx.previousStructure!.primitives.variables[i];
      if (prev) previousByCurrentIndex.set(i, prev);
    });
  }

  for (let i = 0; i < structure.primitives.variables.length; i++) {
    const spec = structure.primitives.variables[i];
    const targetName = pathToName(spec.path);
    const previousName = previousByCurrentIndex.has(i)
      ? pathToName(previousByCurrentIndex.get(i)!.path)
      : targetName;
    const existing = primByName.get(previousName) ?? primByName.get(targetName);
    if (!existing) {
      missing++;
      continue;
    }
    if (existing.name !== targetName) {
      existing.name = targetName;
    }
    const value = spec.valuesByMode[structure.primitives.modes[0]];
    if (value && !('aliasOf' in (value as object))) {
      existing.setValueForMode(primModeId, value as RGBA);
      updated++;
    }
  }

  // Refresh primitives map by name after rename (for alias lookups)
  primByName.clear();
  for (const v of primVars) if (v) primByName.set(v.name, v);

  // ---- Semantics ----
  const semVars = await Promise.all(
    ctx.semanticsCollection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
  );
  const semByName = new Map<string, Variable>();
  for (const v of semVars) if (v) semByName.set(v.name, v);

  // Build mode name → modeId for the existing semantics collection.
  const semModeMap: Record<string, string> = {};
  for (const m of ctx.semanticsCollection.modes) {
    semModeMap[m.name] = m.modeId;
  }
  // Ensure both Light and Dark modes exist; create missing.
  for (const requiredMode of structure.semantics.modes) {
    if (!semModeMap[requiredMode]) {
      semModeMap[requiredMode] = ctx.semanticsCollection.addMode(requiredMode);
    }
  }

  for (let i = 0; i < structure.semantics.variables.length; i++) {
    const spec = structure.semantics.variables[i];
    const targetName = pathToName(spec.path);
    const previousName = ctx.previousStructure?.semantics.variables[i]
      ? pathToName(ctx.previousStructure.semantics.variables[i].path)
      : targetName;
    const existing = semByName.get(previousName) ?? semByName.get(targetName);
    if (!existing) {
      missing++;
      continue;
    }
    if (existing.name !== targetName) {
      existing.name = targetName;
    }
    for (const [modeName, value] of Object.entries(spec.valuesByMode)) {
      const modeId = semModeMap[modeName];
      if (!modeId) continue;
      if ('aliasOf' in (value as object)) {
        const ref = value as { aliasOf: { collection: string; path: string[] } };
        const target = primByName.get(pathToName(ref.aliasOf.path));
        if (target) {
          existing.setValueForMode(modeId, figma.variables.createVariableAlias(target));
        }
      } else {
        existing.setValueForMode(modeId, value as RGBA);
      }
    }
    updated++;
  }

  return { updated, missing };
}

// Re-exports for ergonomic import
export { PRIMITIVES, SEMANTICS };
export type { CollectionSpec };
