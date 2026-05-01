import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// Build UI as single self-contained ui.html with all JS+CSS inlined.
// Figma plugins require the UI to be one file.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  css: {
    modules: {
      generateScopedName: 'fui-[name]__[local]',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: resolve(__dirname, 'ui.html'),
      output: {
        entryFileNames: 'ui.js',
        assetFileNames: 'ui.[ext]',
      },
    },
  },
});
