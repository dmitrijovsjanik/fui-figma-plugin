import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  generatePalette,
  checkBackgroundCompression,
  hexToOklch,
  DEFAULT_NAMING_CONFIG,
  DARK_STEP_POSITIONS,
  LIGHT_STEP_POSITIONS,
  SEMANTIC_ROLES,
  type GenerationConfig,
  type GenerationResult,
  type NamingConfig,
  type SecondaryConfig,
  type SemanticRole,
} from '../palette-core';
import { BrandInput } from './components/BrandInput';
import { PaletteMatrix, type CurveDisplayMode } from './components/PaletteMatrix';
import { SettingsSidebar } from './components/SettingsSidebar';
import {
  type PersistedState,
  type PerThemeSettings,
  type SemanticNamingConfig,
  type WindowSize,
  DEFAULT_SEMANTIC_NAMING,
  DEFAULT_WINDOW_SIZE,
} from './persistence-types';
import { ResizeHandle } from './components/ResizeHandle';
import { OrphansModal } from './components/OrphansModal';
import { loadStateAsync, saveStateDebounced, postToSandbox } from './persistence';
import type { StepPreset } from './preset-types';
import type { SandboxToUI } from '../messages';
import type { Orphan } from '../figma-builder/apply';

import '../tokens/tokens.css';
import '../tokens/tokens-dark.css';
import '../tokens/sizing.css';
import '../tokens/fonts.css';
import '../styles/globals.css';

const LIGHT_BG = '#ffffff';
const DARK_BG = '#111111';

const DEFAULT_CONFIG: GenerationConfig = {
  brandColor: '#2563EB',
  brandMode: 'auto',
  chromaEqualization: 'independent',
  theme: 'light',
  neutralStyle: 'tinted',
  gamut: 'sRGB',
  backgroundColor: LIGHT_BG,
  darkBrandAdaptation: 'adaptive',
  secondary: {
    mode: 'off',
    harmonyType: 'complementary',
    harmonyVariation: 'positive',
  },
  semanticHarmony: {
    mode: 'off',
    harmonyType: 'triadic',
    strength: 0.5,
  },
};

const DEFAULT_PRESET: StepPreset = {
  name: 'Standard',
  light: { ...LIGHT_STEP_POSITIONS },
  dark: { ...DARK_STEP_POSITIONS },
  builtIn: true,
};

const DEFAULT_PER_THEME = {
  light: { backgroundColor: LIGHT_BG } as PerThemeSettings,
  dark: { backgroundColor: DARK_BG } as PerThemeSettings,
};

function defaultPersistedState(): PersistedState {
  return {
    config: DEFAULT_CONFIG,
    perTheme: DEFAULT_PER_THEME,
    displayMode: 'semantic',
    colorFormat: 'alpha',
    curveDisplayMode: 'position',
    namingConfig: DEFAULT_NAMING_CONFIG,
    semanticNaming: DEFAULT_SEMANTIC_NAMING,
    presets: [DEFAULT_PRESET],
    activePresetName: 'Standard',
    previousAppliedNaming: null,
    windowSize: DEFAULT_WINDOW_SIZE,
  };
}

export function PluginApp() {
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [namingConfig, setNamingConfig] = useState<NamingConfig>(DEFAULT_NAMING_CONFIG);
  const [semanticNaming, setSemanticNaming] = useState<SemanticNamingConfig>(DEFAULT_SEMANTIC_NAMING);
  const [displayMode, setDisplayMode] = useState<'semantic' | 'fill'>('semantic');
  const [colorFormat, setColorFormat] = useState<'alpha' | 'solid'>('alpha');
  const [curveDisplayMode, setCurveDisplayMode] = useState<CurveDisplayMode>('position');
  const perThemeRef = useRef<typeof DEFAULT_PER_THEME>(DEFAULT_PER_THEME);
  const [presets, setPresets] = useState<StepPreset[]>([DEFAULT_PRESET]);
  const presetsRef = useRef(presets);
  presetsRef.current = presets;
  const [activePresetName, setActivePresetName] = useState<string | null>('Standard');
  const [windowSize, setWindowSize] = useState<WindowSize>(DEFAULT_WINDOW_SIZE);
  const [pendingOrphans, setPendingOrphans] = useState<Orphan[] | null>(null);

  // Listen for sync-result with orphans → open modal.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as SandboxToUI | undefined;
      if (
        msg?.type === 'sync-result' &&
        (msg.status === 'created' || msg.status === 'updated') &&
        msg.orphans &&
        msg.orphans.length > 0
      ) {
        setPendingOrphans(msg.orphans);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Hydrate state from clientStorage on mount
  useEffect(() => {
    void loadStateAsync().then((loaded) => {
      const state = loaded ?? defaultPersistedState();
      const theme = state.config.theme ?? 'light';
      const themeSettings = state.perTheme?.[theme] ?? DEFAULT_PER_THEME[theme];
      setConfig({
        ...DEFAULT_CONFIG,
        ...state.config,
        stepPositions: themeSettings.stepPositions,
        backgroundColor: themeSettings.backgroundColor,
      });
      perThemeRef.current = { ...DEFAULT_PER_THEME, ...state.perTheme };
      const loadedNaming = state.namingConfig ?? DEFAULT_NAMING_CONFIG;
      // Migrate stale default: if the user never customised the secondary
      // role name they're sitting on the old 'secondary' default, which
      // clashes with the -secondary level suffix. Flip them to the new
      // default 'subbrand' on first hydrate after upgrade.
      if (loadedNaming.roleNames?.secondary === 'secondary') {
        loadedNaming.roleNames = { ...loadedNaming.roleNames, secondary: 'subbrand' };
      }
      setNamingConfig(loadedNaming);
      setSemanticNaming(state.semanticNaming ?? DEFAULT_SEMANTIC_NAMING);
      setDisplayMode(state.displayMode ?? 'semantic');
      setColorFormat(state.colorFormat ?? 'alpha');
      setCurveDisplayMode(state.curveDisplayMode ?? 'position');
      setPresets(state.presets?.length ? state.presets : [DEFAULT_PRESET]);
      setActivePresetName(state.activePresetName ?? 'Standard');
      setWindowSize(state.windowSize ?? DEFAULT_WINDOW_SIZE);
      setHydrated(true);
    });
  }, []);

  // Persist whenever any persisted slice changes
  useEffect(() => {
    if (!hydrated) return;
    const currentTheme = config.theme;
    perThemeRef.current = {
      ...perThemeRef.current,
      [currentTheme]: {
        stepPositions: config.stepPositions,
        backgroundColor: config.backgroundColor ?? (currentTheme === 'dark' ? DARK_BG : LIGHT_BG),
      },
    };
    const { stepPositions: _sp, backgroundColor: _bg, ...configWithoutPerTheme } = config;
    saveStateDebounced({
      config: configWithoutPerTheme as GenerationConfig,
      perTheme: perThemeRef.current,
      displayMode,
      colorFormat,
      curveDisplayMode,
      namingConfig,
      semanticNaming,
      presets,
      activePresetName,
      previousAppliedNaming: null, // updated separately on Sync success
      windowSize,
    });
  }, [config, displayMode, colorFormat, curveDisplayMode, namingConfig, semanticNaming, presets, activePresetName, windowSize, hydrated]);

  // Default step positions for current theme
  const defaultPositions = useMemo(
    () => (config.theme === 'dark' ? { ...DARK_STEP_POSITIONS } : { ...LIGHT_STEP_POSITIONS }),
    [config.theme],
  );
  const stepPositions = config.stepPositions ?? defaultPositions;

  const handleStepPositionChange = useCallback((step: number, value: number) => {
    setConfig((prev) => {
      const base =
        prev.stepPositions ??
        (prev.theme === 'dark' ? { ...DARK_STEP_POSITIONS } : { ...LIGHT_STEP_POSITIONS });
      const clamped =
        step >= 9 ? Math.max(-0.5, Math.min(0.5, value)) : Math.max(0, Math.min(0.999, value));
      const newPositions = { ...base, [step]: clamped };
      perThemeRef.current = {
        ...perThemeRef.current,
        [prev.theme]: { ...perThemeRef.current[prev.theme], stepPositions: newPositions },
      };
      return { ...prev, stepPositions: newPositions };
    });
  }, []);

  const handleResetStepPosition = useCallback((step: number) => {
    setConfig((prev) => {
      if (!prev.stepPositions) return prev;
      const updated = { ...prev.stepPositions };
      if (step >= 9) {
        delete updated[step];
      } else {
        const defaults = prev.theme === 'dark' ? DARK_STEP_POSITIONS : LIGHT_STEP_POSITIONS;
        updated[step] = defaults[step];
      }
      const defaults = prev.theme === 'dark' ? DARK_STEP_POSITIONS : LIGHT_STEP_POSITIONS;
      const hasStep1to8Overrides = Object.keys(defaults).some(
        (k) => updated[+k] !== undefined && Math.abs(updated[+k] - defaults[+k]) > 0.0001,
      );
      const hasStep9to12Overrides = [9, 10, 11, 12].some((k) => updated[k] !== undefined);
      const newPositions = !hasStep1to8Overrides && !hasStep9to12Overrides ? undefined : updated;
      perThemeRef.current = {
        ...perThemeRef.current,
        [prev.theme]: { ...perThemeRef.current[prev.theme], stepPositions: newPositions },
      };
      return { ...prev, stepPositions: newPositions };
    });
  }, []);

  const handleResetAllStepPositions = useCallback(() => {
    setConfig((prev) => {
      perThemeRef.current = {
        ...perThemeRef.current,
        [prev.theme]: { ...perThemeRef.current[prev.theme], stepPositions: undefined },
      };
      return { ...prev, stepPositions: undefined };
    });
  }, []);

  const handleStepPositionChangeWithPreset = useCallback(
    (step: number, value: number) => {
      setActivePresetName(null);
      handleStepPositionChange(step, value);
    },
    [handleStepPositionChange],
  );

  const handleSavePreset = useCallback((name: string) => {
    const lightPositions = perThemeRef.current.light.stepPositions ?? { ...LIGHT_STEP_POSITIONS };
    const darkPositions = perThemeRef.current.dark.stepPositions ?? { ...DARK_STEP_POSITIONS };
    const newPreset: StepPreset = { name, light: { ...lightPositions }, dark: { ...darkPositions } };
    setPresets((prev) => {
      const existing = prev.findIndex((p) => p.name === name && !p.builtIn);
      return existing >= 0 ? prev.map((p, i) => (i === existing ? newPreset : p)) : [...prev, newPreset];
    });
    setActivePresetName(name);
  }, []);

  const handleLoadPreset = useCallback((name: string) => {
    const preset = presetsRef.current.find((p) => p.name === name);
    if (!preset) return;
    setActivePresetName(name);
    setConfig((prev) => {
      const positions = prev.theme === 'dark' ? { ...preset.dark } : { ...preset.light };
      perThemeRef.current = {
        ...perThemeRef.current,
        light: {
          ...perThemeRef.current.light,
          stepPositions: preset.builtIn ? undefined : { ...preset.light },
        },
        dark: {
          ...perThemeRef.current.dark,
          stepPositions: preset.builtIn ? undefined : { ...preset.dark },
        },
      };
      return { ...prev, stepPositions: preset.builtIn ? undefined : positions };
    });
  }, []);

  const handleDeletePreset = useCallback(
    (name: string) => {
      setPresets((prev) => prev.filter((p) => p.name !== name || p.builtIn));
      if (activePresetName === name) setActivePresetName(null);
    },
    [activePresetName],
  );

  // Sync .dark class on root for theme tokens
  useEffect(() => {
    document.documentElement.classList.toggle('dark', config.theme === 'dark');
  }, [config.theme]);

  // Detect bg too bright/dark
  const bgCompressed = config.backgroundColor
    ? checkBackgroundCompression(hexToOklch(config.backgroundColor).l, config.theme).compressed
    : false;

  // Generate palette on config change
  useEffect(() => {
    if (bgCompressed) return;
    const timer = setTimeout(() => {
      try {
        const r = generatePalette(config);
        setResult(r);
      } catch (e) {
        console.error('Palette generation failed:', e);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [config, bgCompressed]);

  // Sync palette → CSS custom props for live preview inside the plugin window
  useEffect(() => {
    if (!result) return;
    const s = document.documentElement.style;
    const roles = SEMANTIC_ROLES as readonly SemanticRole[];
    for (const role of roles) {
      for (let step = 1; step <= 12; step++) {
        s.setProperty(`--fui-${role}-${step}`, result.palette[role][step as keyof typeof result.palette.brand]);
      }
    }
    if (result.alphaPalette) {
      for (const role of roles) {
        for (let step = 1; step <= 12; step++) {
          const alphaVal = result.alphaPalette[role]?.[step as keyof typeof result.alphaPalette.brand];
          if (alphaVal) s.setProperty(`--fui-${role}-a-${step}`, alphaVal.css);
        }
      }
    }
    if (config.backgroundColor) s.setProperty('--fui-neutral-0', config.backgroundColor);
  }, [result, config.backgroundColor]);

  const handleBrandColorChange = useCallback((color: string) => {
    setConfig((prev) => ({ ...prev, brandColor: color }));
  }, []);

  const handleBackgroundChange = useCallback((color: string) => {
    setConfig((prev) => {
      perThemeRef.current = {
        ...perThemeRef.current,
        [prev.theme]: { ...perThemeRef.current[prev.theme], backgroundColor: color },
      };
      return { ...prev, backgroundColor: color };
    });
  }, []);

  const handleThemeToggle = useCallback(() => {
    setConfig((prev) => {
      const newTheme = prev.theme === 'light' ? 'dark' : 'light';
      perThemeRef.current = {
        ...perThemeRef.current,
        [prev.theme]: {
          stepPositions: prev.stepPositions,
          backgroundColor: prev.backgroundColor ?? (prev.theme === 'dark' ? DARK_BG : LIGHT_BG),
        },
      };
      const newThemeSettings = perThemeRef.current[newTheme];
      return {
        ...prev,
        theme: newTheme,
        stepPositions: newThemeSettings.stepPositions,
        backgroundColor: newThemeSettings.backgroundColor,
      };
    });
  }, []);

  const handleConfigChange = useCallback((partial: Partial<GenerationConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleSecondaryColorChange = useCallback((color: string) => {
    setConfig((prev) => ({
      ...prev,
      secondary: { ...prev.secondary!, mode: 'custom' as const, customColor: color },
    }));
  }, []);

  const handleSecondaryConfigChange = useCallback((partial: Partial<SecondaryConfig>) => {
    setConfig((prev) => {
      const merged = { ...prev.secondary!, ...partial };
      if (partial.mode === 'custom' && !merged.customColor) merged.customColor = '#E52563';
      return { ...prev, secondary: merged };
    });
  }, []);

  const generateBothThemes = useCallback(() => {
    const pt = perThemeRef.current;
    const lightResult = generatePalette({
      ...config,
      theme: 'light',
      backgroundColor: pt.light.backgroundColor,
      stepPositions: pt.light.stepPositions,
    });
    const darkResult = generatePalette({
      ...config,
      theme: 'dark',
      backgroundColor: pt.dark.backgroundColor,
      stepPositions: pt.dark.stepPositions,
    });
    return {
      lightResult,
      darkResult,
      lightBg: pt.light.backgroundColor,
      darkBg: pt.dark.backgroundColor,
    };
  }, [config]);

  const handleResize = useCallback((width: number, height: number) => {
    setWindowSize({ width, height });
  }, []);

  if (!hydrated) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--fui-neutral-9)' }}>Loading…</div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--fui-neutral-2)',
        fontFamily: 'var(--fui-font-family)',
      }}
    >
      <main style={{ paddingInline: 16, paddingBlock: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BrandInput
          color={config.brandColor}
          onChange={handleBrandColorChange}
          backgroundColor={config.backgroundColor}
          defaultBackgroundColor={config.theme === 'dark' ? DARK_BG : LIGHT_BG}
          onBackgroundChange={handleBackgroundChange}
          bgCompressed={bgCompressed}
          secondaryConfig={config.secondary}
          secondaryColor={result?.palette.secondary[9]}
          onSecondaryColorChange={handleSecondaryColorChange}
          onSecondaryConfigChange={handleSecondaryConfigChange}
          config={config}
          onConfigChange={handleConfigChange}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          theme={config.theme}
          onThemeToggle={handleThemeToggle}
          colorFormat={colorFormat}
          onColorFormatChange={setColorFormat}
        />
        {result && (
          <>
            <PaletteMatrix
              palette={result.palette}
              oklchPalette={result.oklchPalette}
              alphaPalette={result.alphaPalette}
              onCopy={() => { /* clipboard not used inside plugin */ }}
              secondaryActive={config.secondary?.mode !== 'off'}
              displayMode={displayMode}
              colorFormat={colorFormat}
              stepPositions={stepPositions}
              defaultStepPositions={defaultPositions}
              onStepPositionChange={handleStepPositionChangeWithPreset}
              onResetStepPosition={handleResetStepPosition}
              onResetAllStepPositions={handleResetAllStepPositions}
              curveDisplayMode={curveDisplayMode}
              onCurveDisplayModeChange={setCurveDisplayMode}
              backgroundColor={config.backgroundColor ?? (config.theme === 'dark' ? DARK_BG : LIGHT_BG)}
              theme={config.theme}
              brandMode={config.brandMode}
              defaultStep9L={result.defaultStep9L}
              presets={presets}
              activePresetName={activePresetName}
              onSavePreset={handleSavePreset}
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
            />
            <SettingsSidebar
              namingConfig={namingConfig}
              onNamingConfigChange={setNamingConfig}
              semanticNaming={semanticNaming}
              onSemanticNamingChange={setSemanticNaming}
              onGenerateBothThemes={generateBothThemes}
              secondary={config.secondary}
            />
          </>
        )}
      </main>
      <ResizeHandle onResize={handleResize} />
      {pendingOrphans && (
        <OrphansModal
          orphans={pendingOrphans}
          onConfirm={(ids) => {
            postToSandbox({ type: 'delete-orphans', ids });
            setPendingOrphans(null);
          }}
          onClose={() => setPendingOrphans(null)}
        />
      )}
    </div>
  );
}
