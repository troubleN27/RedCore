import type { Resolution } from '../catalog';
import type { GpuVendor } from '../specs/enums';
import { estimateFps } from './engine';
import type { FpsCpu, FpsGpu, FpsModel, GameData, Preset } from './types';

// Калибровка по реальным замерам (план, §7.2): подбираем α и поправки вендоров каждой игры и
// общий показатель k так, чтобы средняя относительная ошибка (MAPE) была минимальной.
// Замеры считаются снятыми на 32 ГБ двухканальной DDR5-6000, без апскейла и генерации кадров.

export interface FpsMeasurement {
  game: string;
  gpu: string;
  cpu: string;
  resolution: Resolution;
  preset: Preset;
  fps: number;
}

export interface CalibrationResult {
  model: FpsModel;
  games: Record<string, Pick<GameData, 'cpuAlpha' | 'vendorBias'>>;
  mapeBefore: number;
  mapeAfter: number;
  /** Точки, которые удалось сопоставить с играми и индексами */
  points: number;
  skipped: number;
  /** Игры, у которых хватило замеров для подбора α и поправок */
  fitted: string[];
}

interface Resolved {
  point: FpsMeasurement;
  gpu: FpsGpu;
  cpu: FpsCpu;
}

const RAM = { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 } as const;

/** Меньше замеров — коэффициенты игры не трогаем: 2–3 точки на 2–4 параметра дают подгонку под шум. */
export const MIN_POINTS_PER_GAME = 4;

function predict(game: GameData, r: Resolved, model: FpsModel) {
  return estimateFps(
    game,
    r.gpu,
    r.cpu,
    RAM,
    {
      resolution: r.point.resolution,
      preset: r.point.preset,
      upscale: 'off',
      frameGen: 'off',
    },
    model,
  ).fps;
}

function errorSum(game: GameData, points: Resolved[], model: FpsModel) {
  let sum = 0;
  for (const r of points) sum += Math.abs(predict(game, r, model) - r.point.fps) / r.point.fps;
  return sum;
}

const range = (from: number, to: number, step: number) =>
  Array.from(
    { length: Math.round((to - from) / step) + 1 },
    (_, i) => +(from + i * step).toFixed(3),
  );

/** Покоординатный спуск по сетке: α, затем поправка каждого встреченного вендора. */
function fitGame(game: GameData, points: Resolved[], model: FpsModel): GameData {
  let best = { ...game, vendorBias: { ...game.vendorBias } };
  let bestErr = errorSum(best, points, model);
  const vendors = [...new Set(points.map((p) => p.gpu.vendor))] as GpuVendor[];
  for (let pass = 0; pass < 3; pass++) {
    for (const cpuAlpha of range(0.5, 1, 0.05)) {
      const candidate = { ...best, cpuAlpha };
      const err = errorSum(candidate, points, model);
      if (err < bestErr - 1e-9) [best, bestErr] = [candidate, err];
    }
    for (const vendor of vendors) {
      for (const bias of range(0.8, 1.2, 0.02)) {
        const candidate = { ...best, vendorBias: { ...best.vendorBias, [vendor]: bias } };
        const err = errorSum(candidate, points, model);
        if (err < bestErr - 1e-9) [best, bestErr] = [candidate, err];
      }
    }
  }
  return best;
}

export function fpsMape(
  games: readonly GameData[],
  points: readonly Resolved[],
  model: FpsModel,
): number {
  const bySlug = new Map(games.map((g) => [g.slug, g]));
  let sum = 0;
  for (const r of points) sum += errorSum(bySlug.get(r.point.game)!, [r], model);
  return points.length === 0 ? 0 : sum / points.length;
}

export function calibrateFps(
  measurements: readonly FpsMeasurement[],
  games: readonly GameData[],
  gpus: Record<string, FpsGpu>,
  cpus: Record<string, FpsCpu>,
  model: FpsModel,
): CalibrationResult {
  const bySlug = new Map(games.map((g) => [g.slug, g]));
  const resolved: Resolved[] = [];
  for (const point of measurements) {
    const gpu = gpus[point.gpu];
    const cpu = cpus[point.cpu];
    if (bySlug.has(point.game) && gpu && cpu && point.fps > 0) resolved.push({ point, gpu, cpu });
  }
  const mapeBefore = fpsMape(games, resolved, model);

  let best: { model: FpsModel; games: GameData[]; mape: number } = {
    model,
    games: [...games],
    mape: mapeBefore,
  };
  for (const k of [3, 4, 5, 6, 7, 8]) {
    const candidateModel = { ...model, k };
    const fitted = games.map((game) => {
      const own = resolved.filter((r) => r.point.game === game.slug);
      return own.length >= MIN_POINTS_PER_GAME ? fitGame(game, own, candidateModel) : game;
    });
    const mape = fpsMape(fitted, resolved, candidateModel);
    if (mape < best.mape - 1e-9) best = { model: candidateModel, games: fitted, mape };
  }

  return {
    model: best.model,
    // Только игры с достаточным числом замеров — остальные калибровка не меняет
    games: Object.fromEntries(
      best.games
        .filter(
          (g) => resolved.filter((r) => r.point.game === g.slug).length >= MIN_POINTS_PER_GAME,
        )
        .map((g) => [g.slug, { cpuAlpha: g.cpuAlpha, vendorBias: g.vendorBias }]),
    ),
    mapeBefore,
    mapeAfter: best.mape,
    points: resolved.length,
    skipped: measurements.length - resolved.length,
    fitted: games
      .filter((g) => resolved.filter((r) => r.point.game === g.slug).length >= MIN_POINTS_PER_GAME)
      .map((g) => g.slug),
  };
}

/**
 * Разбор простого CSV с заголовком: строки `#` — комментарии, разделитель — запятая.
 * Отсутствие обязательной колонки — ошибка строки 1, остальные строки не разбираются.
 */
export function parseFpsCsvRows(
  text: string,
  required: readonly string[],
  optional: readonly string[] = [],
): {
  rows: { line: number; cells: Record<string, string> }[];
  errors: { line: number; message: string }[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, raw: raw.trim() }))
    .filter((l) => l.raw && !l.raw.startsWith('#'));
  const head = lines.shift();
  const header = head?.raw.split(',').map((h) => h.trim().toLowerCase()) ?? [];
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: head?.line ?? 1, message: `missing columns: ${missing.join(', ')}` }],
    };
  }
  const columns = [...required, ...optional].filter((name) => header.includes(name));
  return {
    rows: lines.map(({ line, raw }) => {
      const cells = raw.split(',').map((c) => c.trim());
      return {
        line,
        cells: Object.fromEntries(columns.map((name) => [name, cells[header.indexOf(name)] ?? ''])),
      };
    }),
    errors: [],
  };
}

/** Разбор CSV замеров: game,gpu,cpu,resolution,preset,fps (заголовок обязателен). */
export function parseFpsCsv(text: string): FpsMeasurement[] {
  const required = ['game', 'gpu', 'cpu', 'resolution', 'preset', 'fps'];
  const { rows, errors } = parseFpsCsvRows(text, required);
  if (errors.length > 0) throw new Error(`CSV: нужны колонки ${required.join(', ')}`);
  return rows.map(({ cells }) => ({
    game: cells.game!,
    gpu: cells.gpu!,
    cpu: cells.cpu!,
    resolution: cells.resolution as Resolution,
    preset: cells.preset as Preset,
    fps: Number(cells.fps),
  }));
}
