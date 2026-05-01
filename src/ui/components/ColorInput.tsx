import { useState, useEffect, useRef, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { parse, formatHex, converter } from 'culori';
import { TextInline } from '../../components/Input/TextInline';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Pipette, ArrowTurnBackwardIcon } from '@hugeicons/core-free-icons';
import { IconBox } from '../../components/Icon/IconBox';

const toHex = converter('rgb');

const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

interface ColorInputProps {
  label: string;
  color: string; // hex
  onChange: (hex: string) => void;
  defaultColor?: string;
}

function parseAnyColor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing as-is (handles hex, rgb(), hsl(), oklch(), named colors, etc.)
  const parsed = parse(trimmed);
  if (parsed) {
    const hex = formatHex(toHex(parsed));
    return hex ?? null;
  }

  // Try adding # for bare hex
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    const withHash = parse(`#${trimmed}`);
    if (withHash) {
      return formatHex(toHex(withHash)) ?? null;
    }
  }

  return null;
}

export function ColorInput({ label, color, onChange, defaultColor }: ColorInputProps) {
  const showReset = defaultColor !== undefined && color !== defaultColor;
  const [inputValue, setInputValue] = useState(color);
  const [isValid, setIsValid] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(color);
    setIsValid(true);
  }, [color]);

  const handleTextChange = useCallback((value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const hex = parseAnyColor(value);
      if (hex) {
        setIsValid(true);
        onChange(hex);
      } else {
        setIsValid(false);
      }
    }, 200);
  }, [onChange]);

  const handlePickerChange = useCallback((hex: string) => {
    setInputValue(hex);
    setIsValid(true);
    onChange(hex);
  }, [onChange]);

  const handleEyeDropper = useCallback(async () => {
    if (!supportsEyeDropper) return;
    try {
      // @ts-expect-error EyeDropper API not yet in all TS libs
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const hex = parseAnyColor(result.sRGBHex);
      if (hex) {
        setInputValue(hex);
        setIsValid(true);
        onChange(hex);
      }
    } catch {
      // User cancelled — do nothing
    }
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--fui-radius-md)',
                border: '1px solid var(--fui-neutral-6)',
                flexShrink: 0,
                cursor: 'pointer',
                backgroundColor: color,
              }}
              aria-label={`Pick ${label} color`}
            />
          </PopoverTrigger>
          <PopoverContent align="start" style={{ width: 'auto', padding: 12 }}>
            <HexColorPicker color={color} onChange={handlePickerChange} />
          </PopoverContent>
        </Popover>
        <div style={{ width: 140 }}>
          <TextInline
            value={inputValue}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="#000000"
            padSize="md"
            textSize={14}
            showLabel={false}
            showCaption={false}
            clearable={false}
            status={!isValid ? 'error' : 'default'}
            trailSlot={
              <>
                {showReset && (
                  <IconBox
                    icon={ArrowTurnBackwardIcon}
                    behavior="highlight"
                    onClick={() => onChange(defaultColor!)}
                    aria-label="Reset to default"
                  />
                )}
                {supportsEyeDropper && (
                  <IconBox
                    icon={Pipette}
                    behavior="highlight"
                    onClick={handleEyeDropper}
                    aria-label="Pick color from screen"
                  />
                )}
              </>
            }
            showTrailSlot={showReset || supportsEyeDropper}
          />
        </div>
      </div>
    </div>
  );
}
