import { useRef, useState } from 'react';
import type { GenerationConfig, SecondaryConfig, SecondaryMode, HarmonyType, HarmonyVariation, ThemeMode } from '../../palette-core';
import { getHarmonyVariations, getHarmonyLabel } from '../../palette-core';
import { ColorInput } from './ColorInput';
import { ContentSwitcher } from '../../components/ContentSwitcher/ContentSwitcher';
import { Tag } from '../../components/Tag/Tag';
import { Dropdown } from '../../components/Dropdown/Dropdown';
import { MenuItem } from '../../components/Menu/MenuItem';
import { Button } from '../../components/Button/Button';
import { Sun01Icon, Moon02Icon, BlendIcon, SlidersHorizontalIcon } from '@hugeicons/core-free-icons';

interface BrandInputProps {
  color: string;
  onChange: (color: string) => void;
  backgroundColor?: string;
  defaultBackgroundColor?: string;
  onBackgroundChange?: (color: string) => void;
  bgCompressed?: boolean;
  secondaryConfig?: SecondaryConfig;
  secondaryColor?: string;
  onSecondaryColorChange?: (color: string) => void;
  onSecondaryConfigChange?: (partial: Partial<SecondaryConfig>) => void;
  config?: GenerationConfig;
  onConfigChange?: (partial: Partial<GenerationConfig>) => void;
  displayMode?: 'semantic' | 'fill';
  onDisplayModeChange?: (mode: 'semantic' | 'fill') => void;
  theme?: ThemeMode;
  onThemeToggle?: () => void;
  colorFormat?: 'alpha' | 'solid';
  onColorFormatChange?: (format: 'alpha' | 'solid') => void;
}

const HARMONY_LABELS: Record<HarmonyType, string> = {
  'complementary': 'Compl',
  'analogous': 'Analog',
  'triadic': 'Triad',
  'split-complementary': 'Split',
  'tetradic': 'Tetrad',
};

function SettingsDropdown({ config, onConfigChange }: { config: GenerationConfig; onConfigChange: (partial: Partial<GenerationConfig>) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={btnRef}
        kind="icon"
        icon={SlidersHorizontalIcon}
        toggleable
        pressed={open}
        buttonType="tertiary"
        status="neutral"
        padSize="md"
        textSize={14}
        onClick={() => setOpen(v => !v)}
        aria-label="Generation settings"
        title="Generation settings"
      />
      <Dropdown
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        itemHeight={36}
        maxVisible={12}
        align="end"
        minWidth={280}
      >
        <div style={{

          borderRadius: 'var(--fui-radius-lg)',
          backgroundColor: config.neutralStyle === 'tinted' ? 'var(--fui-neutral-3)' : undefined,
        }}>
          <MenuItem toggle checked={config.neutralStyle === 'tinted'} onCheckedChange={() => onConfigChange({ neutralStyle: config.neutralStyle === 'tinted' ? 'pure-gray' : 'tinted', tintStrength: config.tintStrength ?? 0.5 })} padSize="md" textSize={14}>
            Tinted Neutral
          </MenuItem>
          {config.neutralStyle === 'tinted' && (
            <div style={{ padding: '0 8px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--fui-neutral-9)', whiteSpace: 'nowrap' }}>
                {Math.round((config.tintStrength ?? 0.5) * 100)}%
              </span>
              <input
                type="range"
                min={0} max={100} step={5}
                value={Math.round((config.tintStrength ?? 0.5) * 100)}
                onChange={(e) => onConfigChange({ tintStrength: +e.target.value / 100 })}
                style={{ width: '100%', accentColor: 'var(--fui-brand-9)' }}
              />
            </div>
          )}
        </div>
        <MenuItem toggle checked={config.brandMode === 'fixed'} onCheckedChange={() => onConfigChange({ brandMode: config.brandMode === 'fixed' ? 'auto' : 'fixed' })} padSize="md" textSize={14}>
          Fixed Brand
        </MenuItem>
        <MenuItem toggle checked={config.darkBrandAdaptation === 'fixed'} disabled={config.brandMode !== 'fixed'} onCheckedChange={() => onConfigChange({ darkBrandAdaptation: config.darkBrandAdaptation === 'fixed' ? 'adaptive' : 'fixed' })} padSize="md" textSize={14}>
          Fixed Dark Brand
        </MenuItem>
        <MenuItem toggle checked={config.chromaEqualization === 'equal'} onCheckedChange={() => onConfigChange({ chromaEqualization: config.chromaEqualization === 'equal' ? 'independent' : 'equal' })} padSize="md" textSize={14}>
          Equal Chroma
        </MenuItem>
        <MenuItem toggle checked={config.equalizeLightness === true} onCheckedChange={() => onConfigChange({ equalizeLightness: !config.equalizeLightness })} padSize="md" textSize={14}>
          Equal Lightness
        </MenuItem>
        <div style={{

          borderRadius: 'var(--fui-radius-lg)',
          backgroundColor: config.semanticHarmony?.mode === 'auto' ? 'var(--fui-neutral-3)' : undefined,
        }}>
          <MenuItem toggle checked={config.semanticHarmony?.mode === 'auto'} onCheckedChange={() => onConfigChange({
            semanticHarmony: {
              mode: config.semanticHarmony?.mode === 'auto' ? 'off' : 'auto',
              harmonyType: config.semanticHarmony?.harmonyType ?? 'triadic',
              strength: config.semanticHarmony?.strength ?? 0.5,
            }
          })} padSize="md" textSize={14}>
            Semantic Harmony
          </MenuItem>
          {config.semanticHarmony?.mode === 'auto' && (
            <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ContentSwitcher
                items={(Object.keys(HARMONY_LABELS) as HarmonyType[]).map(type => ({
                  value: type,
                  label: HARMONY_LABELS[type],
                }))}
                value={config.semanticHarmony.harmonyType}
                onChange={(v) => onConfigChange({
                  semanticHarmony: { ...config.semanticHarmony!, harmonyType: v as HarmonyType }
                })}
                padSize="sm"
                textSize={12}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--fui-neutral-9)', whiteSpace: 'nowrap' }}>
                  {Math.round(config.semanticHarmony.strength * 100)}%
                </span>
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={Math.round(config.semanticHarmony.strength * 100)}
                  onChange={(e) => onConfigChange({
                    semanticHarmony: { ...config.semanticHarmony!, strength: +e.target.value / 100 }
                  })}
                  style={{ width: '100%', accentColor: 'var(--fui-brand-9)' }}
                />
              </div>
            </div>
          )}
        </div>
        <MenuItem toggle checked={config.gamut === 'P3'} onCheckedChange={() => onConfigChange({ gamut: config.gamut === 'P3' ? 'sRGB' : 'P3' })} padSize="md" textSize={14}>
          P3 Gamut
        </MenuItem>
      </Dropdown>
    </>
  );
}

export function BrandInput({
  color,
  onChange,
  backgroundColor,
  defaultBackgroundColor,
  onBackgroundChange,
  bgCompressed,
  secondaryConfig,
  secondaryColor,
  onSecondaryColorChange,
  onSecondaryConfigChange,
  config,
  onConfigChange,
  displayMode,
  onDisplayModeChange,
  theme,
  onThemeToggle,
  colorFormat,
  onColorFormatChange,
}: BrandInputProps) {
  const isSecondaryActive = secondaryConfig && secondaryConfig.mode !== 'off';
  const variations = secondaryConfig ? getHarmonyVariations(secondaryConfig.harmonyType) : [];
  const hasMultipleVariations = variations.length > 1;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Color inputs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
        <ColorInput label="Brand Color" color={color} onChange={onChange} />
        {backgroundColor !== undefined && onBackgroundChange && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ColorInput
              label="Background"
              color={backgroundColor}
              onChange={onBackgroundChange}
              defaultColor={defaultBackgroundColor}
            />
            {bgCompressed && (
              <p style={{ fontSize: 10, color: '#f59e0b', lineHeight: 1.25, maxWidth: 170 }}>
                Background is too bright — palette steps are compressed
              </p>
            )}
          </div>
        )}
      </div>

      {/* Secondary brand + display actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 24, marginTop: 20 }}>
        {secondaryConfig && onSecondaryConfigChange && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Secondary Brand</span>
              <ContentSwitcher
                items={[
                  { value: 'off', label: 'Off' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'custom', label: 'Custom' },
                ]}
                value={secondaryConfig.mode}
                onChange={(v) => onSecondaryConfigChange({ mode: v as SecondaryMode })}
                padSize="md"
                textSize={14}
              />
            </div>

            {secondaryConfig.mode === 'auto' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Harmony</span>
                  <ContentSwitcher
                    items={(Object.keys(HARMONY_LABELS) as HarmonyType[]).map(type => ({
                      value: type,
                      label: HARMONY_LABELS[type],
                    }))}
                    value={secondaryConfig.harmonyType}
                    onChange={(v) => onSecondaryConfigChange({ harmonyType: v as HarmonyType })}
                    padSize="md"
                    textSize={14}
                  />
                </div>

                {hasMultipleVariations && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Variation</span>
                    <ContentSwitcher
                      items={variations.map(v => ({
                        value: v,
                        label: getHarmonyLabel(secondaryConfig.harmonyType, v),
                      }))}
                      value={secondaryConfig.harmonyVariation}
                      onChange={(v) => onSecondaryConfigChange({ harmonyVariation: v as HarmonyVariation })}
                      padSize="md"
                      textSize={14}
                    />
                  </div>
                )}

                {secondaryColor && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>Preview</span>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--fui-radius-md)',
                        border: '1px solid var(--fui-neutral-6)',
                        backgroundColor: secondaryColor,
                      }}
                      title={secondaryColor}
                    />
                  </div>
                )}
              </>
            )}

            {secondaryConfig.mode === 'custom' && onSecondaryColorChange && (
              <ColorInput
                label="Secondary Color"
                color={secondaryConfig.customColor || '#E52563'}
                onChange={onSecondaryColorChange}
              />
            )}
          </>
        )}

        {/* Display & actions — right-aligned, bottom-aligned */}
        {config && onConfigChange && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginLeft: 'auto' }}>
            {displayMode && onDisplayModeChange && (
              <Tag selectable selected={displayMode === 'fill'} onSelectedChange={() => onDisplayModeChange(displayMode === 'fill' ? 'semantic' : 'fill')} padSize="md" textSize={14}>
                Fill Display
              </Tag>
            )}
            {colorFormat && onColorFormatChange && (
              <Button
                kind="icon"
                icon={BlendIcon}
                toggleable
                pressed={colorFormat === 'alpha'}
                buttonType="tertiary"
                status="neutral"
                padSize="md"
                textSize={14}
                onClick={() => onColorFormatChange(colorFormat === 'alpha' ? 'solid' : 'alpha')}
                aria-label="Toggle alpha colors"
                title={colorFormat === 'alpha' ? 'Alpha colors' : 'Solid colors'}
              />
            )}
            {theme && onThemeToggle && (
              <Button
                kind="icon"
                icon={theme === 'dark' ? Moon02Icon : Sun01Icon}
                toggleable
                pressed={theme === 'dark'}
                buttonType="tertiary"
                status="neutral"
                padSize="md"
                textSize={14}
                onClick={() => onThemeToggle()}
                aria-label="Toggle dark theme"
                title={theme === 'dark' ? 'Dark theme' : 'Light theme'}
              />
            )}
            <SettingsDropdown config={config} onConfigChange={onConfigChange} />
          </div>
        )}
      </div>
    </div>
  );
}
