// Shape of the state persisted to figma.clientStorage.
// Mirrors the original theme-builder's PersistedState plus naming + previousAppliedNaming.

import type { GenerationConfig, NamingConfig } from '../palette-core';
import type { CurveDisplayMode } from './components/PaletteMatrix';
import type { StepPreset } from './preset-types';

export type SemanticSection = 'bg' | 'fg' | 'border' | 'ring' | 'overlay';

export interface SemanticNamingConfig {
  sectionNames: Record<SemanticSection, string>;
  separator: string;
}

export const DEFAULT_SEMANTIC_NAMING: SemanticNamingConfig = {
  sectionNames: { bg: 'bg', fg: 'fg', border: 'border', ring: 'ring', overlay: 'overlay' },
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
  } | null;
  windowSize: WindowSize;
}

export const DEFAULT_WINDOW_SIZE: WindowSize = { width: 560, height: 640 };
export const MIN_WINDOW_SIZE: WindowSize = { width: 380, height: 400 };
