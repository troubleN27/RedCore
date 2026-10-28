import { defineConfig } from 'drizzle-kit';
import { loadRootEnv, migrationDatabaseUrl } from './src/env';

loadRootEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  // generate работает без БД; studio и migrate требуют строку подключения
  dbCredentials: { url: migrationDatabaseUrl() ?? 'postgresql://localhost/redcore' },
});
