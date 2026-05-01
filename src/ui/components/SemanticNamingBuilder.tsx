import { TextInline } from '../../components/Input/TextInline';
import {
  type SemanticNamingConfig,
  type SemanticSection,
  DEFAULT_SEMANTIC_NAMING,
} from '../persistence-types';

const SECTIONS: SemanticSection[] = ['bg', 'fg', 'border', 'overlay'];

interface SemanticNamingBuilderProps {
  config: SemanticNamingConfig;
  onChange: (config: SemanticNamingConfig) => void;
}

export function SemanticNamingBuilder({ config, onChange }: SemanticNamingBuilderProps) {
  const updateSection = (section: SemanticSection, value: string) => {
    onChange({
      ...config,
      sectionNames: { ...config.sectionNames, [section]: value },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--fui-neutral-9)', fontWeight: 500 }}>
        Semantic sections
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {SECTIONS.map((section) => (
          <InlineInput
            key={section}
            value={config.sectionNames[section]}
            defaultValue={DEFAULT_SEMANTIC_NAMING.sectionNames[section]}
            onChange={(v) => updateSection(section, v)}
          />
        ))}
      </div>
    </div>
  );
}

function InlineInput({
  value,
  defaultValue,
  onChange,
}: {
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  const isCustom = value !== defaultValue;

  const handleChange = (input: string) => {
    if (input === '') {
      onChange(defaultValue);
    } else {
      onChange(input);
    }
  };

  return (
    <div style={{ display: 'inline-flex', width: 96 }}>
      <TextInline
        value={isCustom ? value : ''}
        placeholder={defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        padSize="md"
        textSize={14}
        showLabel={false}
        showCaption={false}
        clearable={isCustom}
        onClear={() => onChange(defaultValue)}
      />
    </div>
  );
}
