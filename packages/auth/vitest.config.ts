/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// jsdom for the route-guard component tests (render into a DOM); the react
// plugin transforms the .tsx guards with the automatic JSX runtime.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
