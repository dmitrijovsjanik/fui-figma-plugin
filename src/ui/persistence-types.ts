// Shape of the state persisted to figma.clientStorage.
// Mirrors the original theme-builder's PersistedState plus naming + previousAppliedNaming.

import type { GenerationConfig, NamingConfig, SemanticConfig } from '../palette-core';
import type { CurveDisplayMode } from './components/PaletteMatrix';
import type { StepPreset } from './preset-types';

export type SemanticSection = 'bg' | 'fg' | 'border' | 'overlay';

export interface SemanticNamingConfig {
  sectionNames: Record<SemanticSection, string>;
  separator: string;
}

export const DEFAULT_SEMANTIC_NAMING: SemanticNamingConfig = {
  sectionNames: { bg: 'bg', fg: 'fg', border: 'border', overlay: 'overlay' },
  separator: '/',
};

export interface PerThemeSettings {
  stepPositions?: Record<number, number>;
  backgroundColor: string;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface PersistedState {
  config: GenerationConfig;
  perTheme: { light: PerThemeSettings; dark: PerThemeSettings };
  displayMode: 'semantic' | 'fill';
  colorFormat: 'alpha' | 'solid';
  curveDisplayMode: CurveDisplayMode;
  namingConfig: NamingConfig;
  semanticNaming: SemanticNamingConfig;
  // Editable semantic-token graph. Optional during migration — undefined means
  // the user is on the pre-CRUD-editor build and should be seeded with
  // DEFAULT_SEMANTIC_CONFIG on hydration.
  semanticConfig?: SemanticConfig;
  presets: StepPreset[];
  // Name of the currently-selected preset, or null if user is on a custom
  // (un-saved) configuration. Restored on plugin reload so the active
  // preset highlight survives across sessions.
  activePresetName: string | null;
  // Last naming successfully applied to Figma (for rename detection on Sync update).
  // null when no Sync has succeeded yet.
  previousAppliedNaming: {
    namingConfig: NamingConfig;
    semanticNaming: SemanticNamingConfig;
    semanticConfig?: SemanticConfig;
  } | null;
  windowSize: WindowSize;
}

export const DEFAULT_WINDOW_SIZE: WindowSize = { width: 560, height: 640 };
export const MIN_WINDOW_SIZE: WindowSize = { width: 380, height: 400 };
