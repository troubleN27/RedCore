import { buildLines, gpuIndexFor, type Build, type PerfIndex, type Resolution } from './catalog';
import { checkBuild } from './compat/engine';
import { requiredCpuIndex } from './compat/rules';
import type { PcComponentType } from './specs/enums';

// Анализ баланса сборки (план, §8 «Проверка и оптимизация»): детерминированные эвристики.
// Агент только объясняет найденное и предлагает замену — сами выводы считает этот код.

export type AnalysisCode =
  | 'cpu_bottleneck'
  | 'gpu_weak_for_cpu'
  | 'psu_tight'
  | 'psu_oversized'
  | 'ram_single_channel'
  | 'ram_low_for_tier'
  | 'vram_low_for_resolution'
  | 'gpu_budget_share_low'
  | 'motherboard_overspend'
  | 'storage_small'
  | 'hdd_only';

export interface AnalysisFinding {
  code: AnalysisCode;
  severity: 'warning' | 'info';
  slots: PcComponentType[];
  params: Record<string, string | number>;
  /** Что менять: слот и направление (дешевле/мощнее) — для suggest_alternatives */
  fix?: { slot: PcComponentType; direction: 'cheaper' | 'faster' };
}

export function analyzeBuild(
  build: Build,
  perf: PerfIndex,
  options: { resolution?: Resolution; purpose?: 'gaming' | 'workstation' } = {},
): AnalysisFinding[] {
  const resolution = options.resolution ?? '1440p';
  const gaming = (options.purpose ?? 'gaming') === 'gaming';
  const out: AnalysisFinding[] = [];
  const check = checkBuild(build, perf);
  const gpuPerf = build.gpu ? perf.gpu[build.gpu.specs.chip] : undefined;
  const cpuPerf = build.cpu?.perfKey ? perf.cpu[build.cpu.perfKey] : undefined;
  const total = check.totalUzs;

  if (gpuPerf && cpuPerf) {
    const required = requiredCpuIndex(gpuPerf.index1440);
    if (cpuPerf.gamingIndex < required * 0.9) {
      out.push({
        code: 'cpu_bottleneck',
        severity: 'warning',
        slots: ['cpu', 'gpu'],
        params: { lossPercent: Math.round((1 - cpuPerf.gamingIndex / required) * 100) },
        fix: { slot: 'cpu', direction: 'faster' },
      });
    } else if (gaming && cpuPerf.gamingIndex - gpuIndexFor(gpuPerf, resolution) > 0.35) {
      out.push({
        code: 'gpu_weak_for_cpu',
        severity: 'info',
        slots: ['gpu', 'cpu'],
        params: { cpu: cpuPerf.name, gpu: gpuPerf.name },
        fix: { slot: 'gpu', direction: 'faster' },
      });
    }
  }

  const { loadPercent, psuW, recommendedPsuW } = check.power;
  if (loadPercent !== undefined && psuW !== undefined) {
    if (loadPercent > 80 && psuW >= check.power.loadW) {
      out.push({
        code: 'psu_tight',
        severity: 'warning',
        slots: ['psu'],
        params: { loadPercent, recommendedW: recommendedPsuW },
        fix: { slot: 'psu', direction: 'faster' },
      });
    } else if (loadPercent < 35 && psuW >= recommendedPsuW + 300) {
      out.push({
        code: 'psu_oversized',
        severity: 'info',
        slots: ['psu'],
        params: { psuW, recommendedW: recommendedPsuW },
        fix: { slot: 'psu', direction: 'cheaper' },
      });
    }
  }

  if (build.ram.length > 0) {
    const modules = build.ram.reduce((n, l) => n + l.product.specs.modules * l.qty, 0);
    const capacity = build.ram.reduce((n, l) => n + l.product.specs.capacityGb * l.qty, 0);
    if (modules === 1)
      out.push({
        code: 'ram_single_channel',
        severity: 'warning',
        slots: ['ram'],
        params: { capacityGb: capacity },
      });
    if (gaming && gpuPerf && gpuPerf.index1440 >= 1 && capacity < 32)
      out.push({
        code: 'ram_low_for_tier',
        severity: 'info',
        slots: ['ram'],
        params: { capacityGb: capacity },
        fix: { slot: 'ram', direction: 'faster' },
      });
  }

  if (build.gpu && resolution !== '1080p') {
    const need = resolution === '2160p' ? 16 : 12;
    if (build.gpu.specs.vramGb < need)
      out.push({
        code: 'vram_low_for_resolution',
        severity: 'warning',
        slots: ['gpu'],
        params: { vramGb: build.gpu.specs.vramGb, needGb: need, resolution },
        fix: { slot: 'gpu', direction: 'faster' },
      });
  }

  if (gaming && build.gpu && total >= 10_000_000) {
    const share = build.gpu.priceUzs / total;
    if (share < 0.25)
      out.push({
        code: 'gpu_budget_share_low',
        severity: 'info',
        slots: ['gpu'],
        params: { sharePercent: Math.round(share * 100) },
        fix: { slot: 'gpu', direction: 'faster' },
      });
  }
  if (build.motherboard && build.gpu && build.motherboard.priceUzs > build.gpu.priceUzs * 0.6) {
    out.push({
      code: 'motherboard_overspend',
      severity: 'info',
      slots: ['motherboard'],
      params: { ratioPercent: Math.round((build.motherboard.priceUzs / build.gpu.priceUzs) * 100) },
      fix: { slot: 'motherboard', direction: 'cheaper' },
    });
  }

  if (build.storage.length > 0) {
    const lines = buildLines(build).filter((l) => l.product.componentType === 'storage');
    const capacity = build.storage.reduce((n, l) => n + l.product.specs.capacityGb * l.qty, 0);
    if (build.storage.every((l) => l.product.specs.kind === 'hdd'))
      out.push({ code: 'hdd_only', severity: 'warning', slots: ['storage'], params: {} });
    else if (gaming && capacity < 1000 && lines.length > 0)
      out.push({
        code: 'storage_small',
        severity: 'info',
        slots: ['storage'],
        params: { capacityGb: capacity },
      });
  }
  return out;
}
