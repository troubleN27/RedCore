import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BuiltModel } from './build';
import { budgets, manifest, sourceUrl, type ModelEntry } from './manifest';
import { creditsFile, licensesFile, outDir, registryFile } from './paths';

// Отчёт по ассетам: бюджеты (в CI падает при превышении) и атрибуция CC BY —
// ASSETS_LICENSES.md в корне и credits.json для страницы /credits.

export interface CreditEntry {
  kind: 'model' | 'font' | 'data';
  title: string;
  author: string;
  license: string;
  url: string;
  changes: string;
}

/** Атрибуция, не зависящая от скачанных моделей. */
export const staticCredits: CreditEntry[] = [
  {
    kind: 'font',
    title: 'Inter (PDF и OG-картинки)',
    author: 'Rasmus Andersson',
    license: 'SIL Open Font License 1.1',
    url: 'https://github.com/rsms/inter',
    changes: 'без изменений, файлы WOFF из пакета inter-ui',
  },
  {
    kind: 'font',
    title: 'Unbounded (заголовки)',
    author: 'NaN Studio',
    license: 'SIL Open Font License 1.1',
    url: 'https://fonts.google.com/specimen/Unbounded',
    changes: 'без изменений, подключается через next/font',
  },
  {
    kind: 'font',
    title: 'JetBrains Mono (характеристики)',
    author: 'JetBrains',
    license: 'SIL Open Font License 1.1',
    url: 'https://github.com/JetBrains/JetBrainsMono',
    changes: 'без изменений, подключается через next/font',
  },
  {
    kind: 'data',
    title: 'detect-gpu — бенчмарки видеокарт для выбора качества 3D',
    author: 'pmndrs',
    license: 'MIT',
    url: 'https://github.com/pmndrs/detect-gpu',
    changes: 'копия JSON в public/detect-gpu',
  },
];

export function checkBudgets(
  registry: Record<string, BuiltModel>,
  entries: ModelEntry[] = manifest,
): string[] {
  const problems: string[] = [];
  for (const [key, model] of Object.entries(registry)) {
    const entry = entries.find((e) => e.key === key);
    if (!entry) problems.push(`${key}: нет в манифесте (нет данных об авторе и лицензии)`);
    if (model.sizeLod0 > budgets.lod0Bytes)
      problems.push(`${key}: LOD0 ${(model.sizeLod0 / 1e6).toFixed(2)} МБ > 1 МБ`);
    if (model.sizeLod1 > budgets.lod1Bytes)
      problems.push(`${key}: LOD1 ${(model.sizeLod1 / 1e3).toFixed(0)} КБ > 300 КБ`);
    if (entry && model.triangles > entry.lod0Triangles * 1.1)
      problems.push(`${key}: ${model.triangles} треугольников > ${entry.lod0Triangles}`);
  }
  return problems;
}

export function modelCredits(
  registry: Record<string, BuiltModel>,
  entries: ModelEntry[] = manifest,
): CreditEntry[] {
  return entries
    .filter((e) => registry[e.key])
    .map((e) => ({
      kind: 'model' as const,
      title: e.title,
      author: e.author,
      license: 'CC BY 4.0',
      url: sourceUrl(e),
      changes: `прорежение до ${e.lod0Triangles} треугольников, LOD1, текстуры WebP, meshopt-сжатие, масштаб в метрах, замена материалов`,
    }));
}

function licensesMarkdown(credits: CreditEntry[], pending: ModelEntry[]): string {
  const rows = credits.map(
    (c) => `| ${c.title} | ${c.author} | ${c.license} | ${c.url} | ${c.changes} |`,
  );
  const pendingRows = pending.map(
    (e) => `| \`${e.key}\` | ${e.title} | ${e.author} | ${sourceUrl(e)} |`,
  );
  return [
    '# Лицензии ассетов RedCore',
    '',
    'Файл генерируется командой `pnpm assets:report` — не редактируйте вручную.',
    '',
    '## Используются на сайте',
    '',
    '| Ассет | Автор | Лицензия | Источник | Изменения |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'Процедурные 3D-модели (корпуса, платы, кулеры, СЖО, мониторы, периферия) созданы в коде проекта.',
    'Освещение сцены — процедурное (лайтформеры), внешних HDRI нет.',
    '',
    '## Ожидают скачивания (CC BY 4.0)',
    '',
    'Положите GLB в `tooling/3d/raw/<ключ>/model.glb` или задайте `SKETCHFAB_API_TOKEN` и выполните `pnpm assets:fetch && pnpm assets:build`.',
    '',
    '| Ключ | Модель | Автор | Ссылка |',
    '| --- | --- | --- | --- |',
    ...pendingRows,
    '',
  ].join('\n');
}

function main() {
  const registry = existsSync(registryFile)
    ? (JSON.parse(readFileSync(registryFile, 'utf8')) as Record<string, BuiltModel>)
    : {};
  // Файлы реестра должны существовать и совпадать по размеру
  const problems = checkBudgets(registry);
  for (const [key, model] of Object.entries(registry)) {
    for (const [file, size] of [
      [model.lod0, model.sizeLod0],
      [model.lod1, model.sizeLod1],
    ] as const) {
      const full = path.join(outDir, path.basename(file));
      if (!existsSync(full)) problems.push(`${key}: файл ${file} не найден`);
      else if (statSync(full).size !== size)
        problems.push(`${key}: размер ${file} не совпадает с реестром — пересоберите`);
    }
  }

  const credits = [...modelCredits(registry), ...staticCredits];
  writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
  writeFileSync(
    licensesFile,
    licensesMarkdown(
      credits,
      manifest.filter((e) => !registry[e.key]),
    ),
  );

  const built = Object.keys(registry).length;
  console.log(`Моделей GLB: ${built} из ${manifest.length}; остальные подтипы — процедурные.`);
  for (const [key, m] of Object.entries(registry)) {
    console.log(
      `  ${key}: LOD0 ${(m.sizeLod0 / 1e3).toFixed(0)} КБ, LOD1 ${(m.sizeLod1 / 1e3).toFixed(0)} КБ, ${m.triangles} тр.`,
    );
  }
  if (problems.length > 0) {
    console.error(`Бюджеты нарушены:\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('✓ Бюджеты соблюдены, ASSETS_LICENSES.md и credits.json обновлены');
}

if (process.argv[1]?.endsWith('report.ts')) main();
