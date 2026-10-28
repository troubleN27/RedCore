import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema';

/** Любой Postgres-драйвер Drizzle со схемой RedCore: Neon (pg) в проде, PGlite локально. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 10_000 });
  // На Vercel Fluid compute корректно закрывает простаивающие соединения; локально — no-op.
  attachDatabasePool(pool);
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}

/**
 * Встроенный Postgres (PGlite, WASM) в памяти процесса — когда Neon ещё не подключён.
 * Применяет миграции и заливает демо-каталог; живёт до перезапуска сервера.
 */
async function createLocalDatabase(): Promise<Database> {
  const [
    { PGlite },
    { drizzle: drizzlePglite },
    { migrate },
    { migrationsFolder },
    { seedDatabase },
  ] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
    import('./migrator'),
    import('./seed/seed'),
  ]);
  const startedAt = Date.now();
  const db = drizzlePglite({ client: new PGlite(), schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder });
  const stats = await seedDatabase(db as unknown as Database);
  console.info(
    `[db] DATABASE_URL не задан — встроенный PGlite: ${stats.products} товаров за ${Date.now() - startedAt} мс`,
  );
  return db as unknown as Database;
}

const globalForDb = globalThis as typeof globalThis & { __redcoreDb?: Promise<Database> };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function databaseMode(): 'neon' | 'local' {
  return isDatabaseConfigured() ? 'neon' : 'local';
}

/** Ленивый синглтон: переживает HMR в dev; без DATABASE_URL — локальный PGlite с демо-данными. */
export function getDb(): Promise<Database> {
  globalForDb.__redcoreDb ??= process.env.DATABASE_URL
    ? Promise.resolve(createDatabase(process.env.DATABASE_URL) as unknown as Database)
    : createLocalDatabase().catch((error: unknown) => {
        globalForDb.__redcoreDb = undefined;
        throw error;
      });
  return globalForDb.__redcoreDb;
}
