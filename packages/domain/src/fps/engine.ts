import type { Build, PerfIndex, Resolution } from '../catalog';
import {
  DEFAULT_FPS_MODEL,
  type FpsCpu,
  type FpsEstimate,
  type FpsGpu,
  type FpsModel,
  type FpsRam,
  type FpsSettings,
  type GameData,
  type Upscaler,
  type UpscaleMode,
} from './types';

/** U[r,u] — прирост от апскейла: Quality / Balanced / Performance (план, §7.2). */
const UPSCALE: Record<Resolution, Record<Exclude<UpscaleMode, 'off'>, number>> = {
  '1080p': { quality: 1.25, balanced: 1.35, performance: 1.5 },
  '1440p': { quality: 1.35, balanced: 1.5, performance: 1.7 },
  '2160p': { quality: 1.45, balanced: 1.65, performance: 1.95 },
};

/** Множитель генерации кадров: 2× ≈ 1.8, 3× ≈ 2.6, 4× ≈ 3.3 (накладные расходы). */
const FRAME_GEN = { '2x': 1.8, '3x': 2.6, '4x': 3.3 } as const;

export function gpuIndexAt(gpu: FpsGpu, resolution: Resolution): number {
  if (resolution === '1080p') return gpu.index1080;
  if (resolution === '2160p') return gpu.index2160;
  return gpu.index1440;
}

/** Апскейлер, который реально доступен: DLSS — только RTX и только если игра поддерживает. */
export function pickUpscaler(
  game: GameData,
  gpu: FpsGpu,
  wanted: Upscaler | undefined,
): Upscaler | null {
  const available = (u: Upscaler) =>
    u === 'dlss' ? game.supports.dlss && gpu.vendor === 'nvidia' : game.supports[u];
  if (wanted && available(wanted)) return wanted;
  return (['dlss', 'fsr', 'xess'] as const).find(available) ?? null;
}

/** M_ram: двухканал — 1.0, одноканал — 0.85; небольшая поправка на частоту. */
export function ramMultiplier(ram: FpsRam): number {
  let m = ram.channels === 2 ? 1 : 0.85;
  if (ram.type === 'DDR5' && ram.speedMts >= 6000) m *= 1.02;
  if (ram.type === 'DDR4' && ram.speedMts < 3200) m *= 0.97;
  return m;
}

const round = (n: number) => Math.round(n);

export function estimateFps(
  game: GameData,
  gpu: FpsGpu,
  cpu: FpsCpu,
  ram: FpsRam,
  settings: FpsSettings,
  model: FpsModel = DEFAULT_FPS_MODEL,
): FpsEstimate {
  const { resolution, preset } = settings;
  const upscaler = settings.upscale === 'off' ? null : pickUpscaler(game, gpu, settings.upscaler);
  const u = upscaler && settings.upscale !== 'off' ? UPSCALE[resolution][settings.upscale] : 1;
  const bias = game.vendorBias[gpu.vendor] ?? 1;
  const gpuIndex = gpuIndexAt(gpu, resolution);

  const fpsGpu = game.gpuFps[resolution][preset] * gpuIndex * bias * u;
  const fpsCpu = game.cpuFps[preset] * cpu.gamingIndex ** game.cpuAlpha * ramMultiplier(ram);
  // Мягкий минимум: при равенстве ≈ 0.87 от каждого, при сильном перекосе — меньший из двух
  const combined = (fpsGpu ** -model.k + fpsCpu ** -model.k) ** (-1 / model.k);

  // Апскейл рендерит в меньшем разрешении — видеопамяти нужно немного меньше
  const vramReqGb = game.vramGb[resolution][preset] * (upscaler ? 0.9 : 1);
  const vram = Math.min(1, Math.max(0.3, (gpu.vramGb / vramReqGb) ** 1.5));
  const ramPenalty =
    ram.capacityGb < game.ramMinGb ? 0.7 : ram.capacityGb < game.ramRecGb ? 0.93 : 1;
  const uncapped = combined * vram * ramPenalty;
  const capped = game.fpsCap !== null && uncapped >= game.fpsCap;
  const fps = capped ? game.fpsCap! : uncapped;

  const limiter = capped
    ? 'cap'
    : fpsCpu < 0.9 * fpsGpu
      ? 'cpu'
      : fpsGpu < 0.9 * fpsCpu
        ? 'gpu'
        : 'balanced';
  const extrapolated = gpuIndex < 0.45 || gpuIndex > 2 || cpu.gamingIndex < 0.5;
  const spread = extrapolated ? 0.25 : 0.15;
  const lowRatio = game.lowRatio * (limiter === 'cpu' ? 0.95 : 1);

  const fgAllowed =
    settings.frameGen !== 'off' &&
    game.supports.frameGen &&
    (gpu.frameGen === 'mfg' || (gpu.frameGen === 'fg' && settings.frameGen === '2x'));

  return {
    fps: round(fps),
    low1: round(fps * lowRatio),
    // Упор в лимит движка — FPS известен точно, выше лимита диапазон не поднимается
    range: capped ? [fps, fps] : [round(fps * (1 - spread)), round(fps * (1 + spread))],
    fpsGpu: round(fpsGpu),
    fpsCpu: round(fpsCpu),
    limiter,
    rating:
      fps >= game.thresholds.good ? 'great' : fps >= game.thresholds.playable ? 'playable' : 'bad',
    upscaler,
    frameGen:
      fgAllowed && settings.frameGen !== 'off'
        ? { mode: settings.frameGen, fps: round(fps * FRAME_GEN[settings.frameGen]) }
        : null,
    penalties: { vram, ram: ramPenalty },
    vramReqGb: Math.round(vramReqGb * 10) / 10,
    extrapolated,
  };
}

/** Параметры памяти сборки: объём, каналы (≥ 2 модуля — двухканал), тип и частота. */
export function buildRam(build: Build): FpsRam | null {
  if (build.ram.length === 0) return null;
  let capacityGb = 0;
  let modules = 0;
  for (const line of build.ram) {
    capacityGb += line.product.specs.capacityGb * line.qty;
    modules += line.product.specs.modules * line.qty;
  }
  const first = build.ram[0]!.product.specs;
  return {
    capacityGb,
    channels: modules >= 2 ? 2 : 1,
    type: first.type,
    speedMts: Math.min(...build.ram.map((l) => l.product.specs.speedMts)),
  };
}

/** Видеокарта и процессор сборки в виде, нужном калькулятору; null — чего-то не хватает. */
export function buildFpsParts(
  build: Build,
  perf: PerfIndex,
): { gpu: FpsGpu; cpu: FpsCpu; ram: FpsRam } | null {
  const gpuPerf = build.gpu ? perf.gpu[build.gpu.specs.chip] : undefined;
  const cpuPerf = build.cpu?.perfKey ? perf.cpu[build.cpu.perfKey] : undefined;
  if (!build.gpu || !gpuPerf || !cpuPerf) return null;
  // Без памяти считаем по типовой: 2×16 ГБ того типа, что поддерживает плата/процессор
  const ram = buildRam(build) ?? {
    capacityGb: 32,
    channels: 2,
    type: build.cpu?.specs.memoryTypes.includes('DDR5') ? 'DDR5' : 'DDR4',
    speedMts: 6000,
  };
  return { gpu: { ...gpuPerf, vramGb: build.gpu.specs.vramGb }, cpu: cpuPerf, ram };
}
