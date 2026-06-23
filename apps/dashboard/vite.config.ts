/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// Opt-in bundle visualizer: `ANALYZE=1 pnpm --filter dashboard build`
// emits dist/stats.html with an interactive treemap of what's actually
// in each chunk. Useful for the "where's the 1.5MB coming from?"
// investigation; not loaded in normal builds so it doesn't slow CI.
const analyze = process.env.ANALYZE === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            open: true,
          }),
        ]
      : []),
  ],
  server: {
    port: 5941,
  },
  build: {
    chunkSizeWarningLimit: 1500,
    // manualChunks was emitting separate vendor-react / vendor-antd / etc.
    // chunks. antd reads React.version on module load; when antd lives in
    // a different chunk and the chunks load out of order, antd crashes
    // with "Cannot read properties of undefined (reading 'version')" in
    // production (caught 12.06.2026 post-deploy). Reverted to the default
    // Rollup chunking — one bigger bundle, but stable. Re-attempt later
    // with a more surgical split if cache reuse becomes a measured pain.
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
