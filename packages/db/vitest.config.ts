import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Интеграционный тест поднимает Postgres в WASM (PGlite) — это занимает несколько секунд
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
