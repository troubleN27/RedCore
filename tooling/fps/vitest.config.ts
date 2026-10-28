import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Калибровка поднимает Postgres в WASM (PGlite) с seed — на раннерах CI это небыстро
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
