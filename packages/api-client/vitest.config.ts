/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

// jsdom gives us window / navigator / localStorage — the axios interceptor
// touches all three (Authorization header, navigator.onLine offline guard,
// window.location redirect on force-logout).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
