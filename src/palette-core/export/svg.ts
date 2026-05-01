import type { Palette, AlphaPalette, NamingConfig, SemanticRole } from '../types';
import { SEMANTIC_ROLES, STEP_INDICES } from '../types';

export interface SVGExportInput {
  light: { palette: Palette; alphaPalette?: AlphaPalette };
  dark: { palette: Palette; alphaPalette?: AlphaPalette };
  naming: NamingConfig;
  excludeRoles?: SemanticRole[];
}

const SWATCH_W = 48;
const SWATCH_H = 48;
const GAP = 2;
const SECTION_GAP = 32;
const PADDING = 16;

const CELL_W = SWATCH_W + GAP;
const CELL_H = SWATCH_H + GAP;
const GRID_W = 12 * CELL_W;

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface SectionDef {
  theme: 'light' | 'dark';
  mode: 'solid' | 'alpha';
  palette: Palette;
  alphaPalette?: AlphaPalette;
  offsetX: number;
  offsetY: number;
  roles: SemanticRole[];
}

function renderSection(lines: string[], section: SectionDef, naming: NamingConfig): void {
  const { theme, mode, palette, alphaPalette, offsetX, offsetY, roles } = section;
  const isAlpha = mode === 'alpha';
  const bgColor = theme === 'light' ? '#ffffff' : '#111113';
  const themeName = naming.themeNames[theme];

  lines.push(`<g transform="translate(${offsetX}, ${offsetY})">`);

  if (isAlpha) {
    const bgId = escapeXml(`${themeName}/${naming.roleNames.neutral}/0`);
    lines.push(`<rect id="${bgId}" x="0" y="0" width="${GRID_W}" height="${roles.length * CELL_H}" fill="${bgColor}" rx="4" />`);
  }

  for (let r = 0; r < roles.length; r++) {
    const role = roles[r];
    const roleName = naming.roleNames[role];
    const ry = r * CELL_H;

    for (let c = 0; c < 12; c++) {
      const step = STEP_INDICES[c];
      const sx = c * CELL_W;
      const sy = ry;

      const id = escapeXml(`${themeName}/${roleName}/${step}${isAlpha ? '-alpha' : ''}`);

      if (isAlpha && alphaPalette) {
        const alpha = alphaPalette[role][step];
        lines.push(`<rect id="${id}" x="${sx}" y="${sy}" width="${SWATCH_W}" height="${SWATCH_H}" rx="3" fill="rgb(${alpha.r},${alpha.g},${alpha.b})" fill-opacity="${alpha.a}" />`);
      } else {
        const hex = palette[role][step];
        lines.push(`<rect id="${id}" x="${sx}" y="${sy}" width="${SWATCH_W}" height="${SWATCH_H}" rx="3" fill="${hex}" />`);
      }
    }
  }

  lines.push('</g>');
}

export function exportSVG(input: SVGExportInput): string {
  const roles = input.excludeRoles
    ? SEMANTIC_ROLES.filter(r => !input.excludeRoles!.includes(r))
    : SEMANTIC_ROLES;
  const GRID_H = roles.length * CELL_H;

  const totalW = PADDING + GRID_W + SECTION_GAP + GRID_W + PADDING;
  const totalH = PADDING + GRID_H + SECTION_GAP + GRID_H + PADDING;

  const leftX = PADDING;
  const rightX = PADDING + GRID_W + SECTION_GAP;
  const topY = PADDING;
  const bottomY = PADDING + GRID_H + SECTION_GAP;

  const sections: SectionDef[] = [
    { theme: 'light', mode: 'solid', palette: input.light.palette, alphaPalette: input.light.alphaPalette, offsetX: leftX, offsetY: topY, roles },
    { theme: 'light', mode: 'alpha', palette: input.light.palette, alphaPalette: input.light.alphaPalette, offsetX: rightX, offsetY: topY, roles },
    { theme: 'dark', mode: 'solid', palette: input.dark.palette, alphaPalette: input.dark.alphaPalette, offsetX: leftX, offsetY: bottomY, roles },
    { theme: 'dark', mode: 'alpha', palette: input.dark.palette, alphaPalette: input.dark.alphaPalette, offsetX: rightX, offsetY: bottomY, roles },
  ];

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`);
  lines.push(`<rect width="${totalW}" height="${totalH}" fill="#f5f5f5" rx="8" />`);

  for (const section of sections) {
    renderSection(lines, section, input.naming);
  }

  lines.push('</svg>');
  return lines.join('\n');
}
