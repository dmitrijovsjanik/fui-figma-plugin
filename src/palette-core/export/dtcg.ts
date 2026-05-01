import type { Palette, AlphaPalette, OklchPalette, NamingConfig, SemanticRole } from '../types';
import { SEMANTIC_ROLES, STEP_INDICES } from '../types';
import { colorToFloatComponents } from '../gamut-mapper';

export interface DTCGExportInput {
  light: { palette: Palette; oklchPalette: OklchPalette; alphaPalette?: AlphaPalette };
  dark: { palette: Palette; oklchPalette: OklchPalette; alphaPalette?: AlphaPalette };
  naming: NamingConfig;
  excludeRoles?: SemanticRole[];
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function isP3Color(color: string): boolean {
  return color.startsWith('color(display-p3');
}

export function exportDTCG(input: DTCGExportInput): string {
  const { naming, excludeRoles } = input;
  const roles = excludeRoles
    ? SEMANTIC_ROLES.filter(r => !excludeRoles.includes(r))
    : SEMANTIC_ROLES;
  const tokens: Record<string, unknown> = {};

  for (const theme of ['light', 'dark'] as const) {
    const data = input[theme];
    const themeName = naming.themeNames[theme];

    tokens[themeName] = {
      $description: `${themeName} theme color tokens`,
    };

    for (const role of roles) {
      const roleName = naming.roleNames[role];
      const solidName = naming.modeNames.solid;
      const alphaName = naming.modeNames.alpha;

      const solidGroup: Record<string, unknown> = {
        $type: 'color',
      };

      for (const step of STEP_INDICES) {
        const color = data.palette[role][step];
        const oklch = data.oklchPalette[role][step];
        const p3 = isP3Color(color);
        const [r, g, b] = colorToFloatComponents(color).map(round) as [number, number, number];

        solidGroup[String(step)] = {
          $value: {
            colorSpace: p3 ? 'display-p3' : 'srgb',
            components: [r, g, b],
            ...(p3 ? {} : { hex: color }),
          },
          $extensions: {
            'com.fast-ui': {
              oklch: {
                l: round(oklch.l),
                c: round(oklch.c),
                h: round(oklch.h),
              },
            },
          },
        };
      }

      (tokens[themeName] as Record<string, unknown>)[roleName] = {
        [solidName]: solidGroup,
      };

      if (data.alphaPalette) {
        const alphaGroup: Record<string, unknown> = {
          $type: 'color',
        };

        for (const step of STEP_INDICES) {
          const alpha = data.alphaPalette[role][step];
          const p3 = alpha.css.startsWith('color(display-p3');

          // For P3: parse float components from css string; for sRGB: use r/g/b integers
          const components: [number, number, number] = p3
            ? (() => {
                const m = alpha.css.match(/color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
                return m
                  ? [round(parseFloat(m[1])), round(parseFloat(m[2])), round(parseFloat(m[3]))]
                  : [round(alpha.r / 255), round(alpha.g / 255), round(alpha.b / 255)];
              })()
            : [round(alpha.r / 255), round(alpha.g / 255), round(alpha.b / 255)];

          alphaGroup[String(step)] = {
            $value: {
              colorSpace: p3 ? 'display-p3' : 'srgb',
              components,
              alpha: round(alpha.a),
            },
          };
        }

        ((tokens[themeName] as Record<string, unknown>)[roleName] as Record<string, unknown>)[alphaName] = alphaGroup;
      }
    }
  }

  return JSON.stringify(tokens, null, 2);
}
