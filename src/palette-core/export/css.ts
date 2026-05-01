import type { Palette, AlphaPalette, NamingConfig, SemanticRole } from '../types';
import { SEMANTIC_ROLES, STEP_INDICES } from '../types';

export interface CSSExportOptions {
  naming?: NamingConfig;
  prefix?: string;
  excludeRoles?: SemanticRole[];
}

export function exportCSS(
  palette: Palette,
  options: CSSExportOptions = {},
  alphaPalette?: AlphaPalette,
  backgroundColor?: string
): string {
  const { naming, prefix = '', excludeRoles } = options;
  const roles = excludeRoles
    ? SEMANTIC_ROLES.filter(r => !excludeRoles.includes(r))
    : SEMANTIC_ROLES;
  const lines: string[] = [':root {'];

  if (backgroundColor) {
    const neutralName = naming ? naming.roleNames.neutral : 'neutral';
    const solidMode = naming ? naming.modeNames.solid : '';
    const varName = solidMode
      ? `${prefix}${neutralName}-${solidMode}-0`
      : `${prefix}${neutralName}-0`;
    lines.push(`  --${varName}: ${backgroundColor};`);
    lines.push('');
  }

  for (const role of roles) {
    const scale = palette[role];
    const roleName = naming ? naming.roleNames[role] : role;
    const solidMode = naming ? naming.modeNames.solid : '';
    const alphaMode = naming ? naming.modeNames.alpha : 'a';

    lines.push(`  /* ${roleName} */`);

    for (const step of STEP_INDICES) {
      const varName = solidMode
        ? `${prefix}${roleName}-${solidMode}-${step}`
        : `${prefix}${roleName}-${step}`;
      lines.push(`  --${varName}: ${scale[step]};`);
    }

    if (alphaPalette) {
      for (const step of STEP_INDICES) {
        const varName = `${prefix}${roleName}-${alphaMode}-${step}`;
        lines.push(`  --${varName}: ${alphaPalette[role][step].css};`);
      }
    }

    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}
