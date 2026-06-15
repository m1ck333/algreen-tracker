import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
