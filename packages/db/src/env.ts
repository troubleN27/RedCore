import { existsSync } from 'node:fs';
import path from 'node:path';

/** Корень монорепо — ближайшая вверх папка с pnpm-workspace.yaml. */
export function findRepoRoot(from = process.cwd()): string {
  let dir = path.resolve(/*turbopackIgnore: true*/ from);
  while (!existsSync(path.join(/*turbopackIgnore: true*/ dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(/*turbopackIgnore: true*/ dir);
    if (parent === dir) return path.resolve(/*turbopackIgnore: true*/ from);
    dir = parent;
  }
  return dir;
}

/**
 * Подгружает корневые .env.local и .env (если есть) — единый источник переменных
 * для Next.js, скриптов БД и MCP. Уже заданные переменные окружения не перезаписываются.
 */
export function loadRootEnv(): void {
  const root = findRepoRoot();
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.join(/*turbopackIgnore: true*/ root, file);
    if (existsSync(/*turbopackIgnore: true*/ fullPath)) process.loadEnvFile(fullPath);
  }
}

/** Прямое (unpooled) подключение для миграций, иначе обычное. */
export function migrationDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined;
}
