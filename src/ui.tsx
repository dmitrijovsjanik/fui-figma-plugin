import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PluginApp } from './ui/PluginApp';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <PluginApp />
  </StrictMode>,
);
