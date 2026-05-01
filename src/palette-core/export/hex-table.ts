import type { Palette, SemanticRole } from '../types';
import { SEMANTIC_ROLES, STEP_INDICES } from '../types';

export function exportHexTable(palette: Palette, excludeRoles?: SemanticRole[]): string {
  const roles = excludeRoles
    ? SEMANTIC_ROLES.filter(r => !excludeRoles.includes(r))
    : SEMANTIC_ROLES;
  const header = ['Role', ...STEP_INDICES.map(s => `Step ${s}`)].join('\t');
  const rows = roles.map(role => {
    const colors = STEP_INDICES.map(step => palette[role][step]);
    return [role, ...colors].join('\t');
  });

  return [header, ...rows].join('\n');
}
