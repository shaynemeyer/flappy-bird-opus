import { defineConfig } from 'vite';

// Relative base so the built game can be served from any static host or opened
// from a subdirectory.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
