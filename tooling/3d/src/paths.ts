import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const toolingDir = path.resolve(here, '..');
export const repoRoot = path.resolve(toolingDir, '..', '..');
/** Исходники: tooling/3d/raw/<key>/*.glb — скачанные или положенные вручную (в .gitignore) */
export const rawDir = path.join(toolingDir, 'raw');
/** Результат: раздаётся CDN Vercel как статика */
export const outDir = path.join(repoRoot, 'apps', 'web', 'public', 'models');
export const registryFile = path.join(repoRoot, 'apps', 'web', 'src', 'generated', 'models.json');
export const creditsFile = path.join(repoRoot, 'apps', 'web', 'src', 'generated', 'credits.json');
export const licensesFile = path.join(repoRoot, 'ASSETS_LICENSES.md');

export function rawModelFile(key: string): string | null {
  const dir = path.join(rawDir, key);
  for (const name of ['model.glb', 'scene.glb', `${key}.glb`]) {
    const file = path.join(dir, name);
    if (existsSync(file)) return file;
  }
  return null;
}
