// Тестовая БД: Postgres в WASM (PGlite) с миграциями и демо-каталогом.
// Используется интеграционными тестами сервисов, MCP и агентов — без Docker и сети.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from './client';
import { migrationsFolder } from './migrator';
import * as schema from './schema';
import { DEFAULT_USD_UZS_RATE } from './seed/pricing';
import { seedDatabase } from './seed/seed';

export interface TestDatabase {
  db: Database;
  close: () => Promise<void>;
}

export async function createTestDatabase({ seed = true } = {}): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder });
  if (seed) await seedDatabase(db as unknown as Database, DEFAULT_USD_UZS_RATE);
  return { db: db as unknown as Database, close: () => client.close() };
}
