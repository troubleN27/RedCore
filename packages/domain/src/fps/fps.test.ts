import { describe, expect, it } from 'vitest';
import type { AnyCatalogProduct } from '../catalog';
import { checkBuild } from '../compat/engine';
import {
  airCooler,
  completeBuild,
  cpu,
  gpu,
  motherboard,
  pcCase,
  perf,
  psu,
  ram,
  storage,
  withPart,
} from '../test/fixtures';
import { calibrateFps, parseFpsCsv, parseFpsCsvRows, type FpsMeasurement } from './calibrate';
import { buildFpsParts, buildRam, estimateFps, pickUpscaler, ramMultiplier } from './engine';
import { requiredIndices, reverseFps } from './reverse';
import type { FpsCpu, FpsGpu, FpsRam, FpsSettings, GameData, Preset } from './types';

type Quad = [number, number, number, number];
const P: Preset[] = ['low', 'medium', 'high', 'ultra'];
const quad = (q: Quad, f = 1) =>
  Object.fromEntries(P.map((p, i) => [p, Math.round(q[i]! * f)])) as Record<Preset, number>;

function makeGame(over: Partial<GameData> & { g?: Quad; c?: Quad; vram?: number } = {}): GameData {
  const g = over.g ?? [140, 115, 95, 78];
  const vram = over.vram ?? 9;
  return {
    slug: 'test-game',
    name: 'Test Game',
    profile: 'aaa',
    cpuAlpha: 0.8,
    vendorBias: {},
    ramMinGb: 12,
    ramRecGb: 16,
    supports: { dlss: true, fsr: true, xess: true, frameGen: true },
    thresholds: { good: 60, playable: 30 },
    lowRatio: 0.78,
    fpsCap: null,
    gpuFps: { '1080p': quad(g, 1.36), '1440p': quad(g), '2160p': quad(g, 0.52) },
    vramGb: {
      '1080p': quad([vram * 0.6, vram * 0.75, vram * 0.85, vram * 0.86]),
      '1440p': quad([vram * 0.62, vram * 0.76, vram * 0.88, vram]),
      '2160p': quad([vram * 0.8, vram, vram * 1.1, vram * 1.28]),
    },
    cpuFps: quad(over.c ?? [215, 198, 182, 166]),
    ...over,
  };
}

const game = makeGame();
const g5070: FpsGpu = { ...perf.gpu['rtx-5070']!, vramGb: 12 };
const g5090: FpsGpu = { ...perf.gpu['rtx-5090']!, vramGb: 32 };
const g5060: FpsGpu = { ...perf.gpu['rtx-5060']!, vramGb: 8 };
const rx: FpsGpu = { ...g5070, key: 'rx', vendor: 'amd', frameGen: 'fg' };
const top: FpsCpu = perf.cpu['cpu-top']!;
const mid: FpsCpu = perf.cpu['cpu-mid']!;
const weak: FpsCpu = perf.cpu['cpu-weak']!;
const dual: FpsRam = { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 };
const base: FpsSettings = { resolution: '1440p', preset: 'high', upscale: 'off', frameGen: 'off' };
const est = (over: Partial<FpsSettings> = {}, g = g5070, c = top, r = dual, gm = game) =>
  estimateFps(gm, g, c, r, { ...base, ...over });

describe('калькулятор FPS: модель', () => {
  it('монотонность: сильнее железо — больше FPS, тяжелее настройки — меньше', () => {
    expect(est({}, g5090).fps).toBeGreaterThan(est().fps);
    expect(est({}, g5060).fps).toBeLessThan(est().fps);
    expect(est({}, g5070, weak).fps).toBeLessThan(est({}, g5070, mid).fps);
    expect(est({}, g5070, mid).fps).toBeLessThanOrEqual(est().fps);
    const byPreset = P.map((preset) => est({ preset }).fps);
    expect(byPreset).toEqual([...byPreset].sort((a, b) => b - a));
    const byRes = (['1080p', '1440p', '2160p'] as const).map(
      (resolution) => est({ resolution }).fps,
    );
    expect(byRes).toEqual([...byRes].sort((a, b) => b - a));
  });

  it('эталонная пара: мягкий минимум ≈ 0.87 от равных половин', () => {
    const equal = makeGame({ g: [100, 100, 100, 100], c: [100, 100, 100, 100], cpuAlpha: 1 });
    const r = estimateFps(equal, g5070, top, { ...dual, speedMts: 5600 }, base);
    expect(r.fpsGpu).toBe(100);
    expect(r.fpsCpu).toBe(100);
    expect(r.fps).toBe(87);
    expect(r.limiter).toBe('balanced');
    expect(r.range).toEqual([74, 100]);
  });

  it('ограничитель: слабый CPU в 1080p — упор в процессор, 4K Ultra — в видеокарту', () => {
    const cpuBound = est({ resolution: '1080p', preset: 'low' }, g5090, weak);
    expect(cpuBound.limiter).toBe('cpu');
    expect(cpuBound.fps).toBeLessThanOrEqual(cpuBound.fpsCpu);
    expect(cpuBound.low1).toBeLessThan(cpuBound.fps * game.lowRatio);
    const gpuBound = est({ resolution: '2160p', preset: 'ultra' }, g5060, top);
    expect(gpuBound.limiter).toBe('gpu');
    expect(gpuBound.fps).toBeLessThanOrEqual(gpuBound.fpsGpu);
  });

  it('нехватка видеопамяти: штраф (VRAM / нужно)^1.5, не ниже 0.3', () => {
    const heavy = makeGame({ vram: 12 });
    const r = est({ preset: 'ultra' }, g5060, top, dual, heavy);
    expect(r.penalties.vram).toBeCloseTo((8 / 12) ** 1.5, 3);
    expect(r.vramReqGb).toBe(12);
    const extreme = makeGame({ vram: 40 });
    expect(est({ preset: 'ultra' }, g5060, top, dual, extreme).penalties.vram).toBe(0.3);
    expect(est({ preset: 'ultra' }, g5090, top, dual, heavy).penalties.vram).toBe(1);
  });

  it('память: меньше минимума — 0.7, меньше рекомендованной — 0.93; одноканал режет CPU', () => {
    expect(est({}, g5070, top, { ...dual, capacityGb: 8 }).penalties.ram).toBe(0.7);
    expect(est({}, g5070, top, { ...dual, capacityGb: 12 }).penalties.ram).toBe(0.93);
    expect(ramMultiplier({ ...dual, channels: 1, speedMts: 5600 })).toBe(0.85);
    expect(ramMultiplier({ capacityGb: 16, channels: 2, type: 'DDR4', speedMts: 2666 })).toBe(0.97);
    expect(est({}, g5070, top, { ...dual, channels: 1 }).fpsCpu).toBeLessThan(est().fpsCpu);
  });

  it('апскейл: коэффициенты по разрешению, DLSS только у RTX и в поддерживающих играх', () => {
    const native = est({ resolution: '2160p', preset: 'ultra' }, g5060);
    const perfMode = est({ resolution: '2160p', preset: 'ultra', upscale: 'performance' }, g5060);
    expect(perfMode.fpsGpu / native.fpsGpu).toBeCloseTo(1.95, 1);
    expect(est({ upscale: 'quality' }).fpsGpu / est().fpsGpu).toBeCloseTo(1.35, 1);
    expect(perfMode.upscaler).toBe('dlss');
    expect(est({ upscale: 'quality', upscaler: 'dlss' }, rx).upscaler).toBe('fsr');
    const none = makeGame({ supports: { dlss: false, fsr: false, xess: false, frameGen: false } });
    expect(pickUpscaler(none, g5070, 'fsr')).toBeNull();
    expect(est({ upscale: 'performance' }, g5070, top, dual, none).fpsGpu).toBe(est().fpsGpu);
  });

  it('генерация кадров: отдельная цифра; FG — только 2×, MFG — до 4×', () => {
    const mfg = est({ frameGen: '4x' });
    expect(mfg.frameGen?.mode).toBe('4x');
    expect(Math.abs(mfg.frameGen!.fps - mfg.fps * 3.3)).toBeLessThanOrEqual(2);
    expect(est({ frameGen: '4x' }, rx).frameGen).toBeNull();
    expect(
      Math.abs(est({ frameGen: '2x' }, rx).frameGen!.fps - est({}, rx).fps * 1.8),
    ).toBeLessThanOrEqual(2);
    const noFg = makeGame({ supports: { ...game.supports, frameGen: false } });
    expect(est({ frameGen: '2x' }, g5070, top, dual, noFg).frameGen).toBeNull();
    expect(est({ frameGen: '2x' }).fps).toBe(est().fps);
  });

  it('лимит движка, цвет оценки и расширенный диапазон вдали от эталонов', () => {
    const capped = makeGame({ fpsCap: 60 });
    const r = est({}, g5090, top, dual, capped);
    expect(r).toMatchObject({ fps: 60, limiter: 'cap', range: [60, 60], rating: 'great' });
    expect(est({ resolution: '2160p', preset: 'ultra' }, g5060).rating).toBe('bad');
    const competitive = makeGame({
      profile: 'competitive',
      thresholds: { good: 144, playable: 60 },
    });
    expect(est({}, g5070, top, dual, competitive).rating).toBe('playable');
    expect(est({}, g5070, weak).extrapolated).toBe(true);
    const wide = est({}, g5070, weak);
    expect(wide.range[1] / wide.fps).toBeCloseTo(1.25, 1);
    const vendor = makeGame({ vendorBias: { amd: 1.1 } });
    expect(est({}, rx, top, dual, vendor).fpsGpu).toBeGreaterThan(est({}, rx).fpsGpu);
  });

  it('параметры из сборки: память, каналы и видеокарта товара', () => {
    const build = completeBuild();
    const parts = buildFpsParts(build, perf)!;
    expect(parts.gpu.vramGb).toBe(build.gpu!.specs.vramGb);
    expect(parts.ram).toEqual(buildRam(build));
    expect(parts.ram.channels).toBe(2);
    const single = withPart(completeBuild(), ram({ modules: 1, capacityGb: 16 }));
    expect(buildRam(single)).toMatchObject({ channels: 1, capacityGb: 16 });
    const noRam = { ...build, ram: [] };
    expect(buildFpsParts(noRam, perf)!.ram).toMatchObject({ capacityGb: 32, channels: 2 });
    expect(buildFpsParts({ ...build, gpu: undefined }, perf)).toBeNull();
  });
});

const p = (priceUzs: number, extra: { perfKey?: string; stockQty?: number } = {}) => ({
  priceUzs,
  ...extra,
});

const catalog: AnyCatalogProduct[] = [
  cpu({ integratedGraphics: true }, p(2_000_000, { perfKey: 'cpu-weak' })),
  cpu({}, p(3_500_000, { perfKey: 'cpu-mid' })),
  cpu({ tdpW: 120, maxPowerW: 162 }, p(6_000_000, { perfKey: 'cpu-top' })),
  gpu({ chip: 'rtx-5060', vramGb: 8, tbpW: 145, recommendedPsuW: 550 }, p(4_000_000)),
  gpu({}, p(7_000_000)),
  gpu(
    {
      chip: 'rtx-5090',
      vramGb: 32,
      tbpW: 575,
      recommendedPsuW: 1000,
      lengthMm: 357,
      slotWidth: 3.5,
    },
    p(30_000_000),
  ),
  motherboard({}, p(2_500_000)),
  ram({ capacityGb: 16 }, p(900_000)),
  ram({}, p(1_700_000)),
  storage({ capacityGb: 1000 }, p(900_000)),
  airCooler({ tdpRatingW: 250 }, p(600_000)),
  pcCase({}, p(1_000_000)),
  psu({ wattage: 650 }, p(900_000)),
  psu({ wattage: 1200 }, p(2_500_000)),
];

const reverse = (target: number, over: Partial<FpsSettings> = {}, gm = game, cat = catalog) =>
  reverseFps(cat, perf, gm, target, { ...base, ...over });

describe('обратный подбор: «хочу N FPS»', () => {
  it('1440p High, 60 FPS: совместимые сборки в наличии с прогнозом не ниже цели', () => {
    const r = reverse(60);
    expect(r.achievable).toBe(true);
    expect(r.variants.length).toBeGreaterThanOrEqual(2);
    for (const v of r.variants) {
      expect(v.estimate.fps).toBeGreaterThanOrEqual(60);
      expect(checkBuild(v.result.build, perf).issues.filter((i) => i.severity === 'error')).toEqual(
        [],
      );
    }
    // «Минимум» — самый дешёвый, «с запасом» — самый быстрый
    expect(r.variants[0]!.tier).toBe('minimum');
    expect(r.variants[0]!.result.totalUzs).toBeLessThanOrEqual(r.variants.at(-1)!.result.totalUzs);
    expect(r.variants[0]!.estimate.fps).toBeLessThanOrEqual(r.variants.at(-1)!.estimate.fps);
  });

  it('киберспорт 1080p Low, 240 FPS — нужен быстрый процессор', () => {
    const esports = makeGame({ g: [600, 520, 450, 400], c: [600, 560, 520, 480], cpuAlpha: 1 });
    const r = reverse(240, { resolution: '1080p', preset: 'low' }, esports);
    expect(r.achievable).toBe(true);
    for (const v of r.variants) {
      expect(v.estimate.fps).toBeGreaterThanOrEqual(240);
      expect(v.result.build.cpu!.perfKey).not.toBe('cpu-weak');
    }
  });

  it('недостижимая цель — честный ответ и подсказка: ниже пресет или апскейл', () => {
    const r = reverse(95, { resolution: '2160p', preset: 'ultra' });
    expect(r.achievable).toBe(false);
    expect(r.variants).toEqual([]);
    expect(r.suggestion).toEqual({ preset: 'high' });
    expect(reverse(100_000).suggestion).toBeNull();
  });

  it('товары не в наличии не предлагаются', () => {
    const outOfStock = catalog.map((item) =>
      item.componentType === 'gpu' && item.specs.chip === 'rtx-5070'
        ? { ...item, stockQty: 0 }
        : item,
    );
    const r = reverse(60, {}, game, outOfStock);
    for (const v of r.variants) expect(v.result.build.gpu!.specs.chip).not.toBe('rtx-5070');
  });

  it('видеопамяти меньше требования игры — такая карта не подбирается', () => {
    const vramHungry = makeGame({ g: [300, 250, 200, 160], vram: 11 });
    const r = reverse(60, { preset: 'ultra' }, vramHungry);
    expect(r.achievable).toBe(true);
    for (const v of r.variants) expect(v.result.build.gpu!.specs.vramGb).toBeGreaterThanOrEqual(11);
    const need = requiredIndices(game, 60, { ...base, upscale: 'off' });
    expect(need.gpuIndex).toBeGreaterThan(0);
    expect(need.cpuIndex).toBeGreaterThan(0);
  });
});

describe('калибровка', () => {
  const gpus = { 'rtx-5070': g5070, 'rtx-5090': g5090, 'rtx-5060': g5060, rx };
  const cpus = { 'cpu-top': top, 'cpu-mid': mid, 'cpu-weak': weak };

  it('восстанавливает α и поправку вендора по «замерам» и снижает MAPE', () => {
    const truth = makeGame({ cpuAlpha: 0.6, vendorBias: { amd: 1.1 } });
    const points: FpsMeasurement[] = [];
    for (const [gk, g] of Object.entries(gpus)) {
      for (const [ck, c] of Object.entries(cpus)) {
        for (const resolution of ['1080p', '1440p'] as const) {
          const fps = estimateFps(truth, g, c, dual, { ...base, resolution }).fps;
          points.push({ game: 'test-game', gpu: gk, cpu: ck, resolution, preset: 'high', fps });
        }
      }
    }
    points.push({
      game: 'unknown',
      gpu: 'rtx-5070',
      cpu: 'cpu-top',
      resolution: '1440p',
      preset: 'high',
      fps: 10,
    });
    const result = calibrateFps(points, [game], gpus, cpus, { k: 5 });
    expect(result.points).toBe(24);
    expect(result.skipped).toBe(1);
    expect(result.mapeAfter).toBeLessThan(result.mapeBefore);
    expect(result.mapeAfter).toBeLessThan(0.01);
    expect(result.games['test-game']!.cpuAlpha).toBeCloseTo(0.6, 1);
    expect(result.games['test-game']!.vendorBias.amd).toBeCloseTo(1.1, 1);
  });

  it('CSV замеров: заголовок, комментарии, ошибка без нужных колонок', () => {
    const csv =
      '# замеры\ngame,gpu,cpu,resolution,preset,fps\ntest-game,rtx-5070,cpu-top,1440p,high,97\n';
    expect(parseFpsCsv(csv)).toEqual([
      {
        game: 'test-game',
        gpu: 'rtx-5070',
        cpu: 'cpu-top',
        resolution: '1440p',
        preset: 'high',
        fps: 97,
      },
    ]);
    expect(() => parseFpsCsv('game,fps\nx,1')).toThrow(/колонки/);
  });
});

describe('крайние случаи', () => {
  it('недостижимо даже на Низких — подсказка про апскейл; пустой каталог — без подсказки', () => {
    const heavy = makeGame({ g: [60, 50, 40, 30] });
    const r = reverse(110, { resolution: '2160p', preset: 'low' }, heavy);
    expect(r.achievable).toBe(false);
    expect(r.suggestion?.upscale).toBeDefined();
    expect(reverse(60, {}, game, []).suggestion).toBeNull();
    // Апскейл уже включён — подсказывать нечего
    expect(reverse(500, { preset: 'low', upscale: 'performance' }).suggestion).toBeNull();
  });

  it('товары без индексов производительности в подбор не попадают', () => {
    const unknown = [
      ...catalog,
      gpu({ chip: 'unknown-chip', vramGb: 24 }, p(1_000_000)),
      cpu({}, p(500_000)),
    ];
    const r = reverse(60, {}, game, unknown);
    for (const v of r.variants) {
      expect(v.result.build.gpu!.specs.chip).not.toBe('unknown-chip');
      expect(v.result.build.cpu!.perfKey).toBeTruthy();
    }
  });

  it('сборка без памяти на DDR4-платформе считается по типовой DDR4', () => {
    const build = completeBuild();
    const ddr4 = {
      ...build,
      ram: [],
      cpu: { ...build.cpu!, specs: { ...build.cpu!.specs, memoryTypes: ['DDR4' as const] } },
    };
    expect(buildFpsParts(ddr4, perf)!.ram.type).toBe('DDR4');
    expect(pickUpscaler(game, g5070, undefined)).toBe('dlss');
    expect(pickUpscaler(game, rx, undefined)).toBe('fsr');
  });

  it('калибровка без сопоставленных точек ничего не меняет; CSV с необязательной колонкой', () => {
    const r = calibrateFps([], [game], {}, {}, { k: 5 });
    expect(r).toMatchObject({ mapeBefore: 0, mapeAfter: 0, points: 0, fitted: [] });
    expect(r.model.k).toBe(5);
    const parsed = parseFpsCsvRows('a,b,c\n1,2\n', ['a', 'b'], ['c', 'd']);
    expect(parsed.rows).toEqual([{ line: 2, cells: { a: '1', b: '2', c: '' } }]);
    expect(parseFpsCsvRows('', ['a']).errors).toEqual([{ line: 1, message: 'missing columns: a' }]);
  });
});
