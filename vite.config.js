import { defineConfig } from 'vite';

// Relative base so the built folder works from any sub-path or a static host.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
