import {
  emptyBuild,
  gpuIndexFor,
  placeProduct,
  type AnyCatalogProduct,
  type Build,
  type CatalogProduct,
  type PerfIndex,
  type Resolution,
} from './catalog';
import { checkBuild, checkCandidate } from './compat/engine';
import { requiredCpuIndex } from './compat/rules';
import type { CompatResult } from './compat/types';
import type { Uzs } from './money';
import { computePower } from './power';
import { componentTypes, type ComponentType } from './specs/enums';

// Детерминированный подборщик сборки. Его вызывают AI-консультант (через MCP) и обратный
// подбор по FPS: модель только формулирует ограничения, а состав считает этот код —
// поэтому в ответах не бывает выдуманных или несовместимых товаров.

export type BuildPurpose = 'gaming' | 'esports' | 'workstation' | 'office';

export interface SolverPreferences {
  platform?: 'amd' | 'intel';
  color?: 'black' | 'white';
  formFactor?: 'atx' | 'matx' | 'itx';
  wifi?: boolean;
}

export interface SolverRequest {
  budgetUzs: Uzs;
  purpose: BuildPurpose;
  resolution?: Resolution;
  preferences?: SolverPreferences;
}

export interface SolverResult {
  build: Build;
  check: CompatResult;
  totalUzs: Uzs;
}

export type ByType = { [T in ComponentType]: CatalogProduct<T>[] };

/** Товары в наличии по типам, от дешёвых к дорогим (стабильный порядок для детерминизма). */
export function groupInStock(catalog: readonly AnyCatalogProduct[]): ByType {
  const groups = Object.fromEntries(componentTypes.map((type) => [type, []])) as unknown as Record<
    ComponentType,
    AnyCatalogProduct[]
  >;
  for (const product of catalog) {
    if (product.stockQty > 0) groups[product.componentType].push(product);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.priceUzs - b.priceUzs || a.id.localeCompare(b.id));
  }
  return groups as unknown as ByType;
}

/** Первый (самый дешёвый) кандидат без ошибок; при равенстве — без предупреждений. */
function pickCheapestCompatible<T extends ComponentType>(
  build: Build,
  candidates: CatalogProduct<T>[],
  perf: PerfIndex,
): CatalogProduct<T> | undefined {
  let fallback: CatalogProduct<T> | undefined;
  for (const candidate of candidates) {
    const verdict = checkCandidate(build, candidate as AnyCatalogProduct, perf);
    if (!verdict.compatible) continue;
    if (!verdict.issues.some((i) => i.severity === 'warning')) return candidate;
    fallback ??= candidate;
  }
  return fallback;
}

const formFactorMap = { atx: 'ATX', matx: 'mATX', itx: 'Mini-ITX' } as const;

/** Мягкое предпочтение: сначала подходящие, потом остальные (порядок по цене сохраняется). */
function preferFirst<T>(items: T[], matches: (item: T) => boolean): T[] {
  return [...items.filter(matches), ...items.filter((item) => !matches(item))];
}

const targets: Record<BuildPurpose, { ramGb: number; storageGb: number }> = {
  gaming: { ramGb: 32, storageGb: 1000 },
  esports: { ramGb: 16, storageGb: 1000 },
  workstation: { ramGb: 64, storageGb: 2000 },
  office: { ramGb: 16, storageGb: 500 },
};

/** Достраивает сборку вокруг выбранных CPU и GPU самыми дешёвыми совместимыми деталями. */
export function composeAround(
  groups: ByType,
  perf: PerfIndex,
  cpu: CatalogProduct<'cpu'>,
  gpu: CatalogProduct<'gpu'> | undefined,
  request: SolverRequest,
): Build | null {
  const prefs = request.preferences ?? {};
  const target = { ...targets[request.purpose] };
  if (request.purpose === 'gaming' && request.budgetUzs < 10_000_000) target.ramGb = 16;
  if (request.purpose !== 'office' && request.budgetUzs >= 25_000_000) target.storageGb = 2000;

  let build = placeProduct(emptyBuild(), cpu);
  if (gpu) build = placeProduct(build, gpu);

  const boards = groups.motherboard.filter(
    (mb) =>
      (!prefs.formFactor || mb.specs.formFactor === formFactorMap[prefs.formFactor]) &&
      (!prefs.wifi || mb.specs.wifi !== 'none') &&
      // Предпочитаем DDR5, если процессор его поддерживает
      (!cpu.specs.memoryTypes.includes('DDR5') ||
        mb.specs.memoryType === 'DDR5' ||
        cpu.specs.socket === 'AM4'),
  );
  const motherboard = pickCheapestCompatible(build, boards, perf);
  if (!motherboard) return null;
  build = placeProduct(build, motherboard);

  const minSpeed = motherboard.specs.memoryType === 'DDR5' ? 5600 : 3200;
  const ram = pickCheapestCompatible(
    build,
    preferFirst(
      groups.ram.filter(
        (kit) =>
          kit.specs.capacityGb >= target.ramGb &&
          kit.specs.modules === 2 &&
          kit.specs.speedMts >= minSpeed,
      ),
      (kit) => !prefs.color || kit.specs.color === prefs.color,
    ),
    perf,
  );
  if (!ram) return null;
  build = placeProduct(build, ram);

  const drive = pickCheapestCompatible(
    build,
    groups.storage.filter((d) => d.specs.kind === 'nvme' && d.specs.capacityGb >= target.storageGb),
    perf,
  );
  if (!drive) return null;
  build = placeProduct(build, drive);

  // Боксовый кулер годится для офиса и недорогих CPU; иначе — самый дешёвый с запасом по TDP
  const needsCooler = !cpu.specs.includesCooler || request.purpose !== 'office';
  if (needsCooler) {
    const cooler = pickCheapestCompatible(
      build,
      groups.cooler.filter((c) => c.specs.tdpRatingW >= cpu.specs.maxPowerW * 0.85),
      perf,
    );
    if (cooler) build = placeProduct(build, cooler);
    else if (!cpu.specs.includesCooler) return null;
  }

  const cases = preferFirst(
    groups.case.filter((c) => prefs.formFactor !== 'itx' || c.specs.formFactor === 'sff'),
    (c) => !prefs.color || c.specs.color === prefs.color,
  );
  const pcCase = pickCheapestCompatible(build, cases, perf);
  if (!pcCase) return null;
  build = placeProduct(build, pcCase);

  const recommended = computePower(build).recommendedPsuW;
  const psu = pickCheapestCompatible(
    build,
    groups.psu.filter((p) => p.specs.wattage >= recommended),
    perf,
  );
  if (!psu) return null;
  build = placeProduct(build, psu);

  return checkBuild(build, perf).status === 'errors' ? null : build;
}

function platformOk(cpu: CatalogProduct<'cpu'>, prefs?: SolverPreferences): boolean {
  if (!prefs?.platform) return true;
  const isAmd = cpu.specs.socket.startsWith('AM');
  return prefs.platform === 'amd' ? isAmd : !isAmd;
}

/**
 * Подбирает лучшую сборку в рамках бюджета.
 * Игры/киберспорт: перебираем видеокарты от сильной к слабой, к каждой — самый дешёвый CPU
 * без «бутылочного горлышка», и берём первую сборку, которая укладывается в бюджет.
 * Работа: та же схема, но перебираются CPU по многопотоку при видеокарте ~25% бюджета.
 * Офис: CPU с iGPU, без видеокарты.
 */
export function solveBuild(
  catalog: readonly AnyCatalogProduct[],
  perf: PerfIndex,
  request: SolverRequest,
): SolverResult | null {
  const groups = groupInStock(catalog);
  const resolution = request.resolution ?? (request.purpose === 'esports' ? '1080p' : '1440p');
  const cpus = groups.cpu.filter(
    (cpu) => platformOk(cpu, request.preferences) && cpu.perfKey && perf.cpu[cpu.perfKey],
  );
  const cpuPerf = (cpu: CatalogProduct<'cpu'>) => perf.cpu[cpu.perfKey!]!;
  const finish = (build: Build): SolverResult => {
    const check = checkBuild(build, perf);
    return { build, check, totalUzs: check.totalUzs };
  };

  if (request.purpose === 'office') {
    for (const cpu of cpus.filter((c) => c.specs.integratedGraphics)) {
      const build = composeAround(groups, perf, cpu, undefined, request);
      if (build && finish(build).totalUzs <= request.budgetUzs) return finish(build);
    }
    return null;
  }

  const gpus = groups.gpu
    .filter((gpu) => perf.gpu[gpu.specs.chip])
    .sort((a, b) => {
      const diff =
        gpuIndexFor(perf.gpu[b.specs.chip]!, resolution) -
        gpuIndexFor(perf.gpu[a.specs.chip]!, resolution);
      return diff !== 0 ? diff : a.priceUzs - b.priceUzs;
    });

  if (request.purpose === 'workstation') {
    const gpuBudget = request.budgetUzs * 0.25;
    const gpu = gpus.find((g) => g.priceUzs <= gpuBudget) ?? gpus.at(-1);
    const byMultiThread = [...cpus].sort(
      (a, b) =>
        cpuPerf(b).multiThreadIndex - cpuPerf(a).multiThreadIndex || a.priceUzs - b.priceUzs,
    );
    for (const cpu of byMultiThread) {
      const build = composeAround(groups, perf, cpu, gpu, request);
      if (build && finish(build).totalUzs <= request.budgetUzs) return finish(build);
    }
    return null;
  }

  for (const gpu of gpus) {
    if (gpu.priceUzs > request.budgetUzs * 0.6) continue;
    const required = requiredCpuIndex(perf.gpu[gpu.specs.chip]!.index1440);
    // Самый дешёвый достаточный CPU; если такого нет — самый быстрый из доступных
    const sufficient = cpus.filter((cpu) => cpuPerf(cpu).gamingIndex >= required);
    const ordered =
      sufficient.length > 0
        ? sufficient
        : [...cpus].sort((a, b) => cpuPerf(b).gamingIndex - cpuPerf(a).gamingIndex);
    for (const cpu of ordered.slice(0, 4)) {
      const build = composeAround(groups, perf, cpu, gpu, request);
      if (build && finish(build).totalUzs <= request.budgetUzs) return finish(build);
    }
  }
  return null;
}

export interface BuildVariants {
  cheaper: SolverResult | null;
  balanced: SolverResult | null;
  stronger: SolverResult | null;
}

/** Три варианта для консультанта: дешевле (−20%), в бюджет и мощнее (+25%). */
export function solveBuildVariants(
  catalog: readonly AnyCatalogProduct[],
  perf: PerfIndex,
  request: SolverRequest,
): BuildVariants {
  const at = (factor: number) =>
    solveBuild(catalog, perf, { ...request, budgetUzs: Math.round(request.budgetUzs * factor) });
  return { cheaper: at(0.8), balanced: at(1), stronger: at(1.25) };
}
