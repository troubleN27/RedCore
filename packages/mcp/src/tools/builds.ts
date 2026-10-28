import type { McpServer } from '@modelcontextprotocol/server';
import {
  buildFpsParts,
  buildLines,
  checkBuild,
  estimateFps,
  frameGenModes,
  presets,
  resolutions,
  solveBuildVariants,
  upscaleModes,
  upscalers,
  type Build,
  type CompatResult,
  type FpsGpu,
  type SolverResult,
} from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import { BuildValidationError, getFpsData, getPerfIndex, resolveBuild } from '@redcore/services';
import { z } from 'zod';
import type { McpContext } from '../context';
import { defineTool, ToolError } from '../define';
import { productCard, snapshotOf } from './catalog';

export const itemsSchema = z
  .array(
    z.object({ slug: z.string().min(1).max(160), qty: z.number().int().min(1).max(8).default(1) }),
  )
  .min(1)
  .max(30);

/** Позиции «slug × количество» → доменная сборка; неизвестный товар — понятная ошибка. */
export async function buildFromItems(ctx: McpContext, items: z.infer<typeof itemsSchema>) {
  const snapshot = await snapshotOf(ctx);
  try {
    return resolveBuild(snapshot, items);
  } catch (error) {
    if (error instanceof BuildValidationError)
      throw new ToolError(error.reason, `${error.reason}: ${error.details ?? ''}`.trim());
    throw error;
  }
}

/** Проверка совместимости с текстами на языке клиента (те же ключи compat.*, что на сайте). */
export function describeCheck(ctx: McpContext, check: CompatResult) {
  const t = getTranslator(ctx.locale) as unknown as (key: string, params?: object) => string;
  return {
    status: check.status,
    totalUzs: check.totalUzs,
    total: formatPrice(check.totalUzs, ctx.locale),
    missing: check.missing,
    power: {
      loadW: check.power.loadW,
      recommendedPsuW: check.power.recommendedPsuW,
      psuW: check.power.psuW ?? null,
      loadPercent: check.power.loadPercent ?? null,
    },
    issues: check.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      slots: issue.slots,
      message: t(`compat.${issue.code}`, issue.params ?? {}),
    })),
  };
}

function describeBuild(ctx: McpContext, result: SolverResult) {
  return {
    totalUzs: result.totalUzs,
    total: formatPrice(result.totalUzs, ctx.locale),
    status: result.check.status,
    items: buildLines(result.build).map((l) => ({ slug: l.product.slug, qty: l.qty })),
    // Компактно: без характеристик — полную карточку модель берёт через get_product
    parts: buildLines(result.build).map((l) => ({
      slot: l.product.componentType,
      slug: l.product.slug,
      name: `${l.product.brand} ${l.product.name}`,
      qty: l.qty,
      price: formatPrice(l.product.priceUzs, ctx.locale),
    })),
    power: result.check.power.loadW,
  };
}

const fpsSettings = {
  resolution: z.enum(resolutions).default('1440p'),
  preset: z.enum(presets).default('high'),
  upscale: z.enum(upscaleModes).default('off'),
  upscaler: z.enum(upscalers).optional(),
  frameGen: z.enum(frameGenModes).default('off'),
};

export function registerBuildTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: 'check_compatibility',
      title: 'Проверка совместимости',
      description:
        'Check a PC build for compatibility (socket, memory, case clearance, cooling, power, ' +
        'balance). Items are product slugs with quantities. Returns status, localized issues ' +
        'with fixes, total price and PSU load/recommendation.',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({ items: itemsSchema }),
    },
    async ({ items }) => {
      const { build, lines } = await buildFromItems(ctx, items);
      const check = checkBuild(build, await getPerfIndex(ctx.db));
      return {
        ...describeCheck(ctx, check),
        parts: lines.map((l) => ({ slot: l.slot, qty: l.qty, ...productCard(ctx, l.product) })),
      };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'list_games',
      title: 'Игры калькулятора FPS',
      description: 'Games available in the FPS estimator with their profiles and upscaler support.',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({}),
    },
    async () => {
      const data = await getFpsData(ctx.db);
      return data.games.map((g) => ({
        slug: g.slug,
        name: g.name,
        profile: g.profile,
        supports: g.supports,
        fpsCap: g.fpsCap,
      }));
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'estimate_fps',
      title: 'Оценка FPS',
      description:
        'Estimate FPS (an estimate, not a benchmark) for a build (product slugs) or for a GPU+CPU ' +
        'pair (perf keys like rtx-5070, ryzen-7-9800x3d). Optional game slugs, resolution ' +
        '1080p/1440p/2160p, preset low/medium/high/ultra, upscaling and frame generation. ' +
        'Returns FPS, range, 1% low, limiter (gpu/cpu) and rating per game.',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({
        items: itemsSchema.optional(),
        gpu: z.string().max(40).optional(),
        cpu: z.string().max(40).optional(),
        games: z.array(z.string().max(80)).max(20).optional(),
        ...fpsSettings,
      }),
    },
    async ({ items, gpu, cpu, games, ...settings }) => {
      const [data, perf] = await Promise.all([getFpsData(ctx.db), getPerfIndex(ctx.db)]);
      let parts: ReturnType<typeof buildFpsParts> = null;
      if (items) {
        parts = buildFpsParts((await buildFromItems(ctx, items)).build as Build, perf);
        if (!parts)
          throw new ToolError('need_gpu_cpu', 'The build needs a graphics card and a CPU');
      } else {
        const g = data.gpus.find((x) => x.key === gpu);
        const c = data.cpus.find((x) => x.key === cpu);
        if (!g || !c) throw new ToolError('unknown_parts', 'Pass items or valid gpu/cpu perf keys');
        parts = {
          gpu: g as FpsGpu,
          cpu: c,
          ram: { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 },
        };
      }
      const selected = games?.length
        ? data.games.filter((g) => games.includes(g.slug))
        : data.games;
      if (selected.length === 0)
        throw new ToolError('unknown_game', 'No such games; see list_games');
      return {
        note: 'Estimate based on reference benchmarks (RTX 5070 / Ryzen 7 9800X3D), ±15–25%',
        gpu: parts.gpu.name,
        cpu: parts.cpu.name,
        settings,
        results: selected.map((game) => {
          const e = estimateFps(game, parts.gpu, parts.cpu, parts.ram, settings, data.model);
          return {
            game: game.slug,
            name: game.name,
            fps: e.fps,
            range: e.range,
            low1: e.low1,
            limiter: e.limiter,
            rating: e.rating,
            frameGenFps: e.frameGen?.fps ?? null,
            upscaler: e.upscaler,
          };
        }),
      };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'generate_builds',
      title: 'Подбор сборки',
      description:
        'Generate compatible PC builds from in-stock products for a budget in UZS and a purpose ' +
        '(gaming, esports, workstation, office). Returns three variants: cheaper (−20%), ' +
        'balanced (budget) and stronger (+25%), each with items (slug, qty) and totals.',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({
        budgetUzs: z.number().int().min(3_000_000).max(500_000_000),
        purpose: z.enum(['gaming', 'esports', 'workstation', 'office']).default('gaming'),
        resolution: z.enum(resolutions).optional(),
        platform: z.enum(['amd', 'intel']).optional(),
        color: z.enum(['black', 'white']).optional(),
        formFactor: z.enum(['atx', 'matx', 'itx']).optional(),
        wifi: z.boolean().optional(),
      }),
    },
    async ({ budgetUzs, purpose, resolution, ...preferences }) => {
      const [snapshot, perf] = await Promise.all([snapshotOf(ctx), getPerfIndex(ctx.db)]);
      const variants = solveBuildVariants(snapshot.products, perf, {
        budgetUzs,
        purpose,
        resolution,
        preferences,
      });
      return Object.fromEntries(
        Object.entries(variants).map(([key, result]) => [
          key,
          result ? describeBuild(ctx, result) : null,
        ]),
      );
    },
  );
}
