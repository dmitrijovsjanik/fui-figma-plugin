// Two-dropdown picker (scale + step) for a single PrimitiveRef value.
// Renders the resolved color as a swatch next to the dropdowns.
//
// Special handling:
//  - In role-slot mode (`mode === 'slot'`): the scale dropdown is locked to
//    '{role}' and only the step/alpha is editable. The swatch shows the brand
//    role for preview (since {role} hasn't been substituted yet).
//  - In standalone mode (`mode === 'standalone'`): full freedom over scale,
//    plus the special 'white-fixed' option (auto-disables step/alpha) and
//    'black' scale (alpha-only).

import { Select } from '../../components/Input/Select';
import {
  PRIMITIVE_SCALE_NAMES,
  type GenerationResult,
  type SemanticRole,
} from '../../palette-core';

type Mode = 'standalone' | 'slot';

export interface PrimitiveRefPickerProps {
  mode: Mode;
  value: string;                  // ref string like 'gray.9' / 'gray.a3' / '{role}.9' / 'white-fixed' / 'black.a8'
  onChange: (next: string) => void;
  includeSecondary?: boolean;     // hide 'secondary' scale option if false
  previewRole?: SemanticRole;     // used to render swatch for {role}-based refs
  previewResult?: GenerationResult | null;
}

interface ParsedRef {
  scale: string;                  // 'gray' | 'accent' | '{role}' | 'black' | 'white-fixed' | ...
  step: number;
  isAlpha: boolean;
}

function parseRefValue(ref: string): ParsedRef {
  if (ref === 'white-fixed') return { scale: 'white-fixed', step: 0, isAlpha: false };
  const [scale, stepRaw] = ref.split('.');
  const isAlpha = stepRaw?.startsWith('a') ?? false;
  const step = Number(isAlpha ? stepRaw.slice(1) : stepRaw);
  return { scale, step: isNaN(step) ? 1 : step, isAlpha };
}

function buildRef(parsed: ParsedRef): string {
  if (parsed.scale === 'white-fixed') return 'white-fixed';
  const prefix = parsed.isAlpha ? 'a' : '';
  return `${parsed.scale}.${prefix}${parsed.step}`;
}

// Color swatch resolution: walks the active palette for the role/scale.
function resolveSwatchColor(
  ref: string,
  previewRole: SemanticRole | undefined,
  previewResult: GenerationResult | null | undefined,
): string {
  if (!previewResult) return 'transparent';
  if (ref === 'white-fixed') return '#ffffff';
  const parsed = parseRefValue(ref);
  if (parsed.scale === 'black') {
    // Approximate the black alpha by step.
    const black: Record<number, number> = { 1: 0.012, 2: 0.024, 3: 0.05, 4: 0.075, 5: 0.10, 6: 0.13, 7: 0.17, 8: 0.24, 9: 0.43, 10: 0.50, 11: 0.62, 12: 0.92 };
    const a = black[parsed.step] ?? 0;
    return `rgba(0, 0, 0, ${a})`;
  }
  // Map scale string → SemanticRole
  const scaleToRole: Record<string, SemanticRole> = {
    gray: 'neutral', accent: 'brand', secondary: 'secondary',
    green: 'success', amber: 'warning', red: 'danger', blue: 'info',
  };
  let role: SemanticRole | undefined;
  if (parsed.scale === '{role}') {
    role = previewRole ?? 'brand';
  } else {
    role = scaleToRole[parsed.scale];
  }
  if (!role) return 'transparent';
  const step = (parsed.step === 0 ? 1 : parsed.step) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  if (parsed.isAlpha && previewResult.alphaPalette) {
    return previewResult.alphaPalette[role]?.[step]?.css ?? 'transparent';
  }
  return previewResult.palette[role]?.[step] ?? 'transparent';
}

const STEP_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const STEP_OPTIONS_WITH_ZERO = [{ value: '0', label: '0' }, ...STEP_OPTIONS];

export function PrimitiveRefPicker(props: PrimitiveRefPickerProps) {
  const { mode, value, onChange, includeSecondary = true, previewRole, previewResult } = props;
  const parsed = parseRefValue(value);
  const isWhiteFixed = parsed.scale === 'white-fixed';
  const isBlack = parsed.scale === 'black';

  // Scale dropdown options
  const scaleOptions = (() => {
    if (mode === 'slot') {
      return [{ value: '{role}', label: '{role}' }];
    }
    const opts: { value: string; label: string }[] = PRIMITIVE_SCALE_NAMES
      .filter(s => includeSecondary || s !== 'secondary')
      .map(s => ({ value: s, label: s }));
    opts.push({ value: 'black', label: 'black (alpha)' });
    opts.push({ value: 'white-fixed', label: 'white-fixed' });
    return opts;
  })();

  // Step options: 0 only available for solid (step 0 = background), excluded for alpha and black.
  const stepOptions = isWhiteFixed || isBlack
    ? STEP_OPTIONS // black: 1..12 alpha; white-fixed disabled below
    : parsed.isAlpha
      ? STEP_OPTIONS
      : STEP_OPTIONS_WITH_ZERO;

  const swatch = resolveSwatchColor(value, previewRole, previewResult);

  const handleScale = (next: string) => {
    if (next === 'white-fixed') {
      onChange('white-fixed');
      return;
    }
    if (next === 'black') {
      // Black is alpha-only. Pick a sensible default (a8).
      onChange('black.a8');
      return;
    }
    // Switching to a regular scale — keep step + alpha flag from current state.
    const step = parsed.step === 0 && parsed.isAlpha ? 1 : parsed.step;
    onChange(buildRef({ scale: next, step: step || 1, isAlpha: parsed.isAlpha }));
  };

  const handleStep = (next: string) => {
    if (isWhiteFixed) return;
    const stepNum = Number(next);
    onChange(buildRef({ scale: parsed.scale, step: stepNum, isAlpha: parsed.isAlpha }));
  };

  const handleAlphaToggle = () => {
    if (isWhiteFixed || isBlack) return;
    const isAlpha = !parsed.isAlpha;
    // Switching to alpha forbids step 0 → bump to 1.
    const step = isAlpha && parsed.step === 0 ? 1 : parsed.step;
    onChange(buildRef({ scale: parsed.scale, step, isAlpha }));
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        title={value}
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          flexShrink: 0,
          background: swatch === 'transparent'
            ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
            : swatch,
          boxShadow: 'inset 0 0 0 1px var(--fui-border-neutral-tertiary, rgba(0,0,0,0.1))',
        }}
      />
      <div style={{ minWidth: 120 }}>
        <Select
          options={scaleOptions}
          value={parsed.scale}
          onChange={handleScale}
          padSize="sm"
          textSize={12}
          showLabel={false}
          showCaption={false}
          showLeadSlot={false}
          disabled={mode === 'slot'}
        />
      </div>
      <div style={{ width: 64 }}>
        <Select
          options={stepOptions}
          value={String(parsed.step)}
          onChange={handleStep}
          padSize="sm"
          textSize={12}
          showLabel={false}
          showCaption={false}
          showLeadSlot={false}
          disabled={isWhiteFixed}
        />
      </div>
      <button
        type="button"
        onClick={handleAlphaToggle}
        disabled={isWhiteFixed || isBlack}
        title={parsed.isAlpha ? 'Alpha scale — click to use solid' : 'Solid scale — click to use alpha'}
        style={{
          height: 28,
          padding: '0 8px',
          borderRadius: 6,
          border: '1px solid var(--fui-border-neutral-secondary, rgba(0,0,0,0.15))',
          background: parsed.isAlpha ? 'var(--fui-bg-accent-secondary, rgba(99, 102, 241, 0.1))' : 'transparent',
          color: 'var(--fui-fg-neutral-primary)',
          fontSize: 12,
          fontWeight: 500,
          cursor: isWhiteFixed || isBlack ? 'not-allowed' : 'pointer',
          opacity: isWhiteFixed || isBlack ? 0.5 : 1,
        }}
      >
        α
      </button>
    </div>
  );
}
