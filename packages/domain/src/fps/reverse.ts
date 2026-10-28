import type { AnyCatalogProduct, CatalogProduct, PerfIndex } from '../catalog';
import { checkBuild } from '../compat/engine';
import { composeAround, groupInStock, type SolverResult } from '../solver';
import { buildFpsParts, estimateFps } from './engine';
import {
  DEFAULT_FPS_MODEL,
  presets,
  type FpsEstimate,
  type FpsGpu,
  type FpsModel,
  type FpsSettings,
  type GameData,
  type Preset,
  type UpscaleMode,
} from './types';

// Обратный сценарий: «Хочу X в 1440p на Ультра, 60+ FPS» → 2–3 сборки из товаров в наличии.
// GPU и CPU подбираются по требуемым индексам, остальное добирает тот же подборщик, что и у
// AI-консультанта; каждый вариант перепроверяется прямым расчётом и движком совместимости.

export type ReverseTier = 'minimum' | 'optimal' | 'headroom';

/**
 * Запас по каждой стороне. При равных FPS_GPU и FPS_CPU мягкий минимум даёт ≈ 0.87 от каждого,
 * поэтому для «минимума» обе стороны должны тянуть цель с запасом ~15%.
 */
const TIERS: { tier: ReverseTier; margin: number }[] = [
  { tier: 'minimum', margin: 1.15 },
  { tier: 'optimal', margin: 1.35 },
  { tier: 'headroom', margin: 1.65 },
];

export interface ReverseVariant {
  tier: ReverseTier;
  result: SolverResult;
  estimate: FpsEstimate;
}

export interface ReverseResult {
  achievable: boolean;
  variants: ReverseVariant[];
  /** Если цель недостижима — что поможет: пресет ниже или апскейл */
  suggestion: { preset?: Preset; upscale?: UpscaleMode } | null;
}

// Типовая память подборщика — двухканальная DDR5-6000 (её M_ram = 1.02)
const REF_RAM = { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 } as const;
const REF_CPU_RAM = 1.02;
const REF_CPU = { key: 'ref', name: 'ref', gamingIndex: 1 };

export function reverseFps(
  catalog: readonly AnyCatalogProduct[],
  perf: PerfIndex,
  game: GameData,
  target: number,
  settings: Omit<FpsSettings, 'frameGen'>,
  model: FpsModel = DEFAULT_FPS_MODEL,
): ReverseResult {
  const groups = groupInStock(catalog);
  const full = { ...settings, frameGen: 'off' as const };

  const gpuOf = (gpu: CatalogProduct<'gpu'>): FpsGpu | null => {
    const p = perf.gpu[gpu.specs.chip];
    return p ? { ...p, vramGb: gpu.specs.vramGb } : null;
  };
  // Потолок по видеокарте с учётом нехватки видеопамяти (процессор — эталонный)
  const gpuFps = (gpu: FpsGpu, s = full) => {
    const estimate = estimateFps(game, gpu, REF_CPU, REF_RAM, s, model);
    return estimate.fpsGpu * estimate.penalties.vram;
  };
  const cpuFps = (cpu: CatalogProduct<'cpu'>, preset: Preset) => {
    const p = cpu.perfKey ? perf.cpu[cpu.perfKey] : undefined;
    return p ? game.cpuFps[preset] * p.gamingIndex ** game.cpuAlpha * REF_CPU_RAM : 0;
  };

  const gpus = groups.gpu
    .map((product) => ({ product, perf: gpuOf(product) }))
    .filter((g): g is { product: CatalogProduct<'gpu'>; perf: FpsGpu } => g.perf !== null);
  const cpus = groups.cpu.filter((c) => c.perfKey && perf.cpu[c.perfKey]);

  const variants: ReverseVariant[] = [];
  const seen = new Set<string>();
  for (const { tier, margin } of TIERS) {
    const need = target * margin;
    // Списки уже отсортированы по цене — первые подходящие и есть самые дешёвые
    const gpuCands = gpus.filter((g) => gpuFps(g.perf) >= need).slice(0, 4);
    const cpuCands = cpus.filter((c) => cpuFps(c, settings.preset) >= need).slice(0, 8);
    // Из всех пар — самая дешёвая сборка. Сначала без «бутылочного горлышка» (как его видит
    // движок совместимости), и только если таких нет — с ним
    const valid: (ReverseVariant & { balanced: boolean; key: string })[] = [];
    for (const gpu of gpuCands) {
      for (const cpu of cpuCands) {
        const key = `${gpu.product.id}:${cpu.id}`;
        if (seen.has(key)) continue;
        const build = composeAround(groups, perf, cpu, gpu.product, {
          budgetUzs: 20_000_000,
          purpose: 'gaming',
          resolution: settings.resolution,
        });
        if (!build) continue;
        const check = checkBuild(build, perf);
        if (check.issues.some((i) => i.severity === 'error')) continue;
        const parts = buildFpsParts(build, perf);
        if (!parts) continue;
        const estimate = estimateFps(game, parts.gpu, parts.cpu, parts.ram, full, model);
        if (estimate.fps < target) continue;
        const previous = variants.at(-1);
        if (previous && estimate.fps <= previous.estimate.fps) continue;
        const balanced = !check.issues.some((i) => i.code === 'perf.cpuBottleneck');
        valid.push({
          tier,
          result: { build, check, totalUzs: check.totalUzs },
          estimate,
          balanced,
          key,
        });
      }
    }
    const pool = valid.some((v) => v.balanced) ? valid.filter((v) => v.balanced) : valid;
    const best = pool.sort((a, b) => a.result.totalUzs - b.result.totalUzs)[0];
    if (best) {
      seen.add(best.key);
      variants.push({ tier: best.tier, result: best.result, estimate: best.estimate });
    }
  }

  if (variants.length > 0) return { achievable: true, variants, suggestion: null };

  // Недостижимо: лучшая видеокарта и процессор из наличия — какой пресет или апскейл помогут
  const best = (s: typeof full) => {
    const g = Math.max(0, ...gpus.map((x) => gpuFps(x.perf, s)));
    const c = Math.max(0, ...cpus.map((x) => cpuFps(x, s.preset)));
    if (g === 0 || c === 0) return 0;
    return (g ** -model.k + c ** -model.k) ** (-1 / model.k);
  };
  const lower = presets.slice(0, presets.indexOf(settings.preset)).reverse();
  const preset = lower.find((p) => best({ ...full, preset: p }) >= target);
  if (preset) return { achievable: false, variants, suggestion: { preset } };
  if (settings.upscale === 'off') {
    const upscale = (['quality', 'balanced', 'performance'] as const).find(
      (u) => best({ ...full, upscale: u }) >= target,
    );
    if (upscale) return { achievable: false, variants, suggestion: { upscale } };
  }
  return { achievable: false, variants, suggestion: null };
}

/** Требуемые индексы для цели — для пояснения в интерфейсе («нужна карта уровня …»). */
export function requiredIndices(
  game: GameData,
  target: number,
  settings: Omit<FpsSettings, 'frameGen'>,
  vendor: FpsGpu['vendor'] = 'nvidia',
) {
  const bias = game.vendorBias[vendor] ?? 1;
  const gpuIndex = (target * 1.1) / (game.gpuFps[settings.resolution][settings.preset] * bias);
  const cpuIndex =
    ((target * 1.1) / (game.cpuFps[settings.preset] * REF_CPU_RAM)) ** (1 / game.cpuAlpha);
  return { gpuIndex, cpuIndex, vramGb: game.vramGb[settings.resolution][settings.preset] };
}
