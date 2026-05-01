import { useState, useEffect } from 'react';
import type { GenerationResult, NamingConfig, SecondaryConfig } from '../../palette-core';
import { Button } from '../../components/Button/Button';
import { NamingTemplateBuilder } from './NamingTemplateBuilder';
import { SemanticNamingBuilder } from './SemanticNamingBuilder';
import type { SemanticNamingConfig } from '../persistence-types';
import { buildVariableStructure } from '../../figma-builder/structure';
import { postToSandbox } from '../persistence';
import type { SandboxToUI } from '../../messages';
import type { VariableStructure } from '../../figma-builder/structure';

interface SettingsSidebarProps {
  namingConfig: NamingConfig;
  onNamingConfigChange: (config: NamingConfig) => void;
  semanticNaming: SemanticNamingConfig;
  onSemanticNamingChange: (config: SemanticNamingConfig) => void;
  onGenerateBothThemes: () => {
    lightResult: GenerationResult;
    darkResult: GenerationResult;
    lightBg?: string;
    darkBg?: string;
  };
  secondary?: SecondaryConfig;
  // Last applied structure — sandbox uses it for rename detection.
  // null when no successful sync yet; updated by parent on sync-result success.
  previousStructure: VariableStructure | null;
  onSyncSuccess: (appliedStructure: VariableStructure) => void;
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'created' }
  | { kind: 'updated' }
  | { kind: 'inconsistent'; message: string }
  | { kind: 'error'; message: string };

export function SettingsSidebar({
  namingConfig,
  onNamingConfigChange,
  semanticNaming,
  onSemanticNamingChange,
  onGenerateBothThemes,
  secondary,
  previousStructure,
  onSyncSuccess,
}: SettingsSidebarProps) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });

  // Listen for sync-result from sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as SandboxToUI | undefined;
      if (msg?.type === 'sync-result') {
        if (msg.status === 'created' || msg.status === 'updated') {
          setStatus({ kind: msg.status });
        } else {
          setStatus({ kind: msg.status, message: msg.message ?? 'Unknown error' });
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSync = () => {
    const { lightResult, darkResult, lightBg, darkBg } = onGenerateBothThemes();
    const structure = buildVariableStructure(
      {
        light: {
          palette: lightResult.palette,
          alphaPalette: lightResult.alphaPalette,
          backgroundColor: lightBg ?? '#ffffff',
        },
        dark: {
          palette: darkResult.palette,
          alphaPalette: darkResult.alphaPalette,
          backgroundColor: darkBg ?? '#111111',
        },
        secondary,
      },
      semanticNaming,
    );
    setStatus({ kind: 'syncing' });
    postToSandbox({ type: 'sync', structure, previousStructure });

    // Persist applied structure on next successful result.
    // Use a one-shot listener to capture the next sync-result.
    const onceHandler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as SandboxToUI | undefined;
      if (msg?.type === 'sync-result') {
        if (msg.status === 'created' || msg.status === 'updated') {
          onSyncSuccess(structure);
        }
        window.removeEventListener('message', onceHandler);
      }
    };
    window.addEventListener('message', onceHandler);
  };

  return (
    <div
      style={{
        borderRadius: 'var(--fui-radius-xl)',
        backgroundColor: 'var(--fui-neutral-2)',
        padding: 24,
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <NamingTemplateBuilder config={namingConfig} onChange={onNamingConfigChange} />
      <SemanticNamingBuilder config={semanticNaming} onChange={onSemanticNamingChange} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          buttonType="primary"
          status="brand"
          padSize="md"
          textSize={14}
          onClick={handleSync}
          disabled={status.kind === 'syncing'}
        >
          {status.kind === 'syncing' ? 'Syncing…' : 'Sync to Figma'}
        </Button>
        <SyncStatusLine status={status} />
      </div>
    </div>
  );
}

function SyncStatusLine({ status }: { status: SyncStatus }) {
  if (status.kind === 'idle' || status.kind === 'syncing') return null;
  if (status.kind === 'created') {
    return <span style={{ fontSize: 12, color: 'var(--fui-success-11)' }}>Variables created in Figma</span>;
  }
  if (status.kind === 'updated') {
    return <span style={{ fontSize: 12, color: 'var(--fui-success-11)' }}>Variables updated in Figma</span>;
  }
  return <span style={{ fontSize: 12, color: 'var(--fui-danger-11)' }}>{status.message}</span>;
}
