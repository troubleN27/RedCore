import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '@redcore/db';
import { MIN_POINTS_PER_GAME } from '@redcore/domain';
import { runCalibration } from './run';

// pnpm fps:calibrate [путь к CSV] [--apply]
// Без --apply только считает MAPE до/после и показывает подобранные коэффициенты;
// с --apply записывает их в базу (игры и настройка fps_model) — калькулятор подхватит сразу.

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const file = args.find((a) => !a.startsWith('--')) ?? path.join(here, '..', 'data', 'control.csv');

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const result = await runCalibration(await getDb(), readFileSync(file, 'utf8'), { apply });
console.log(`Замеры: ${file}`);
console.log(`Точек: ${result.points} (пропущено: ${result.skipped})`);
console.log(`MAPE до калибровки:    ${pct(result.mapeBefore)}`);
console.log(`MAPE после калибровки: ${pct(result.mapeAfter)}  (цель ≤ 15%)`);
console.log(
  `k = ${result.model.k}; подобраны коэффициенты ${result.fitted.length} игр (нужно ≥ ${MIN_POINTS_PER_GAME} замеров на игру)`,
);
for (const [slug, fit] of Object.entries(result.games)) {
  const bias = Object.entries(fit.vendorBias)
    .map(([vendor, value]) => `${vendor} ${value}`)
    .join(', ');
  console.log(`  ${slug.padEnd(32)} α ${fit.cpuAlpha.toFixed(2)}${bias ? `  · ${bias}` : ''}`);
}
console.log(
  apply ? 'Коэффициенты записаны в базу.' : 'Это пробный расчёт; --apply запишет коэффициенты.',
);
if (result.mapeAfter > 0.15) process.exitCode = 1;
