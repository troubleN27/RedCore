import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { manifest } from './manifest';
import { rawDir, rawModelFile } from './paths';

// Скачивание моделей через Sketchfab Download API. Нужен личный токен:
// https://sketchfab.com/settings/password → API Token → SKETCHFAB_API_TOKEN в .env.local.
// Без токена положите .glb вручную в tooling/3d/raw/<key>/model.glb (ссылки — в манифесте).

const API = 'https://api.sketchfab.com/v3';

interface ModelInfo {
  name: string;
  user: { displayName: string; username: string };
  license: { slug: string; label: string } | null;
  isDownloadable: boolean;
}

async function main() {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) {
    console.error(
      'SKETCHFAB_API_TOKEN не задан. Скачайте модели вручную по ссылкам из ASSETS_LICENSES.md в tooling/3d/raw/<key>/model.glb.',
    );
    process.exit(1);
  }
  const headers = { Authorization: `Token ${token}` };
  const only = process.argv.slice(2);
  let failed = 0;

  for (const entry of manifest) {
    if (only.length > 0 && !only.includes(entry.key)) continue;
    if (rawModelFile(entry.key)) {
      console.log(`✓ ${entry.key}: уже скачана`);
      continue;
    }
    const info = (await (
      await fetch(`${API}/models/${entry.uid}`, { headers })
    ).json()) as ModelInfo;
    // Лицензию проверяем заново: автор мог её сменить после составления плана
    if (info.license?.slug !== 'by') {
      console.error(
        `✗ ${entry.key}: лицензия «${info.license?.label ?? 'неизвестна'}», ожидалась CC BY 4.0 — пропуск`,
      );
      failed++;
      continue;
    }
    const download = await fetch(`${API}/models/${entry.uid}/download`, { headers });
    if (!download.ok) {
      console.error(`✗ ${entry.key}: Sketchfab ответил ${download.status}`);
      failed++;
      continue;
    }
    const { glb } = (await download.json()) as { glb?: { url: string; size: number } };
    if (!glb) {
      console.error(`✗ ${entry.key}: GLB для скачивания нет`);
      failed++;
      continue;
    }
    const file = await fetch(glb.url);
    const dir = path.join(rawDir, entry.key);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'model.glb'), Buffer.from(await file.arrayBuffer()));
    writeFileSync(
      path.join(dir, 'source.json'),
      JSON.stringify(
        {
          title: info.name,
          author: info.user.displayName,
          license: info.license.label,
          fetchedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(`↓ ${entry.key}: ${(glb.size / 1e6).toFixed(1)} МБ`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

void main();
