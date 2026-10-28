import { existsSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { findRepoRoot } from './env';

/**
 * Папка миграций. Ищем от корня репозитория: внутри бандла Next.js import.meta.dirname
 * указывает на чанк в .next, а не на исходники пакета.
 */
function resolveMigrationsFolder(): string {
  const fromRoot = path.join(
    /*turbopackIgnore: true*/ findRepoRoot(),
    'packages',
    'db',
    'migrations',
  );
  if (existsSync(/*turbopackIgnore: true*/ fromRoot)) return fromRoot;
  return path.join(/*turbopackIgnore: true*/ import.meta.dirname, '..', 'migrations');
}

export const migrationsFolder = resolveMigrationsFolder();

/** Применяет миграции по прямому (unpooled) подключению. */
export async function runMigrations(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

/** Полностью очищает схему public и журнал миграций. Только для dev-веток! */
export async function dropAll(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
  } finally {
    await pool.end();
  }
}
