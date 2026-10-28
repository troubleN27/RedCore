import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/**'],
      exclude: ['src/test/**', 'src/**/*.test.ts', 'src/**/index.ts'],
      // Доменная логика — ядро магазина: держим покрытие не ниже 90%
      thresholds: { lines: 90, statements: 90, functions: 90 },
    },
  },
});
