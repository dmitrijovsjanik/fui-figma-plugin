import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build sandbox code as a single IIFE bundle.
// Figma main thread loads this directly — no module system available.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2017',
    lib: {
      entry: resolve(__dirname, 'src/code.ts'),
      formats: ['iife'],
      name: 'FUIFigmaPluginSandbox',
      fileName: () => 'code.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
