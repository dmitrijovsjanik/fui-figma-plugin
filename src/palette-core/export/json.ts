import type { Palette, AlphaPalette, SemanticRole } from '../types';
import { SEMANTIC_ROLES, STEP_INDICES } from '../types';

export function exportJSON(palette: Palette, alphaPalette?: AlphaPalette, excludeRoles?: SemanticRole[]): string {
  const roles = excludeRoles
    ? SEMANTIC_ROLES.filter(r => !excludeRoles.includes(r))
    : SEMANTIC_ROLES;
  const output: Record<string, Record<string, string>> = {};

  for (const role of roles) {
    output[role] = {};
    for (const step of STEP_INDICES) {
      output[role][String(step)] = palette[role][step];
    }
    if (alphaPalette) {
      for (const step of STEP_INDICES) {
        output[role][`a${step}`] = alphaPalette[role][step].css;
      }
    }
  }

  return JSON.stringify(output, null, 2);
}
