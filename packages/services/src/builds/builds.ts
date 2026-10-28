import { createHash, randomBytes } from 'node:crypto';
import { analyticsEvents, buildItems, builds, type Database } from '@redcore/db';
import {
  buildLines,
  checkBuild,
  emptyBuild,
  isListSlot,
  pcComponentTypes,
  placeProduct,
  type Build,
  type CompatResult,
  type PcComponentType,
  type PerfIndex,
} from '@redcore/domain';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { CatalogSnapshot, ProductSummary } from '../catalog/types';

export const MAX_BUILD_LINES = 20;
const MAX_QTY = 8;

export const buildInputSchema = z.object({
  items: z
    .array(
      z.object({ slug: z.string().min(1).max(200), qty: z.number().int().min(1).max(MAX_QTY) }),
    )
    .min(1)
    .max(MAX_BUILD_LINES),
  name: z.string().trim().max(80).optional(),
  source: z.enum(['manual', 'ai', 'reverse_fps', 'prebuilt']).default('manual'),
});
export type BuildInput = z.input<typeof buildInputSchema>;

export interface BuildLineView {
  slot: PcComponentType;
  product: ProductSummary;
  qty: number;
}

export class BuildValidationError extends Error {
  constructor(
    public readonly reason: 'unknown_product' | 'not_pc_component' | 'invalid_input',
    public readonly details?: string,
  ) {
    super(`Build validation failed: ${reason}${details ? ` (${details})` : ''}`);
  }
}

/**
 * Собирает доменную сборку из позиций «slug × количество» по снимку каталога.
 * Правила слотов — как в конфигураторе (`placeProduct`): одиночный слот и память заменяются,
 * накопители и вентиляторы складываются.
 */
export function resolveBuild(
  snapshot: CatalogSnapshot,
  items: { slug: string; qty: number }[],
): { build: Build; lines: BuildLineView[] } {
  let build = emptyBuild();
  for (const item of items) {
    const product = snapshot.bySlug.get(item.slug);
    if (!product) throw new BuildValidationError('unknown_product', item.slug);
    if (!(pcComponentTypes as readonly string[]).includes(product.componentType)) {
      throw new BuildValidationError('not_pc_component', item.slug);
    }
    const slot = product.componentType as PcComponentType;
    build = placeProduct(build, product, isListSlot(slot) ? item.qty : 1);
  }
  // В сборку клались объекты снимка, поэтому позиции — это те же ProductSummary
  const lines = buildLines(build).map(({ product, qty }) => ({
    slot: product.componentType as PcComponentType,
    product: product as ProductSummary,
    qty,
  }));
  return { build, lines };
}

/** Короткий идентификатор ссылки: 10 символов base62 (~59 бит случайности). */
export function generatePublicId(length = 10): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length * 2);
  let id = '';
  for (let i = 0; id.length < length && i < bytes.length; i++) {
    const byte = bytes[i]!;
    // Отбрасываем значения ≥ 248, чтобы распределение по алфавиту было равномерным
    if (byte < 248) id += alphabet[byte % alphabet.length];
  }
  return id.length === length ? id : generatePublicId(length);
}

export function buildSignature(lines: BuildLineView[]): string {
  const key = lines
    .map((line) => `${line.slot}:${line.product.slug}:${line.qty}`)
    .sort()
    .join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

export interface SavedBuild {
  publicId: string;
  name: string | null;
  createdAt: Date;
  viewCount: number;
  /** Итог на момент сохранения — текущий в check.totalUzs может отличаться */
  savedTotalUzs: number;
  lines: BuildLineView[];
  build: Build;
  check: CompatResult;
}

/**
 * Сохраняет сборку. Цены и характеристики берутся из каталога на сервере — клиенту
 * не доверяем; совместимость пересчитывается, снимок цены и статуса записывается в БД.
 */
export async function saveBuild(
  db: Database,
  snapshot: CatalogSnapshot,
  perf: PerfIndex,
  input: BuildInput,
  userId: string | null = null,
): Promise<SavedBuild> {
  const parsed = buildInputSchema.safeParse(input);
  if (!parsed.success)
    throw new BuildValidationError('invalid_input', parsed.error.issues[0]?.message);
  const { lines, build } = resolveBuild(snapshot, parsed.data.items);
  const check = checkBuild(build, perf);
  const publicId = generatePublicId();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(builds)
      .values({
        publicId,
        userId,
        name: parsed.data.name || null,
        source: parsed.data.source,
        totalUzs: check.totalUzs,
        powerW: check.power.loadW,
        compatStatus: check.status,
        signature: buildSignature(lines),
      })
      .returning({ id: builds.id, createdAt: builds.createdAt });
    await tx.insert(buildItems).values(
      lines.map((line, position) => ({
        buildId: row!.id,
        slot: line.slot,
        productId: line.product.id,
        qty: line.qty,
        position,
      })),
    );
    await tx.insert(analyticsEvents).values({
      type: 'build_saved',
      buildId: row!.id,
      payload: { status: check.status, totalUzs: check.totalUzs, source: parsed.data.source },
    });
    return {
      publicId,
      name: parsed.data.name || null,
      createdAt: row!.createdAt,
      viewCount: 0,
      savedTotalUzs: check.totalUzs,
      lines,
      build,
      check,
    };
  });
}

/**
 * Загружает сохранённую сборку по ссылке. Цены и наличие — текущие (из каталога), поэтому
 * итог может отличаться от снимка на момент сохранения. Товары, снятые с продажи, пропускаются.
 */
export async function getSavedBuild(
  db: Database,
  snapshot: CatalogSnapshot,
  perf: PerfIndex,
  publicId: string,
  { countView = false } = {},
): Promise<SavedBuild | null> {
  if (!/^[0-9A-Za-z]{6,20}$/.test(publicId)) return null;
  const [row] = await db.select().from(builds).where(eq(builds.publicId, publicId));
  if (!row) return null;
  const itemRows = await db
    .select({ productId: buildItems.productId, qty: buildItems.qty })
    .from(buildItems)
    .where(eq(buildItems.buildId, row.id))
    .orderBy(asc(buildItems.position));

  const byId = new Map(snapshot.products.map((p) => [p.id, p]));
  const items = itemRows
    .map((item) => ({ slug: byId.get(item.productId)?.slug, qty: item.qty }))
    .filter((item): item is { slug: string; qty: number } => Boolean(item.slug));
  const { build, lines } = resolveBuild(snapshot, items);

  if (countView) {
    await db
      .update(builds)
      .set({ viewCount: sql`${builds.viewCount} + 1` })
      .where(eq(builds.id, row.id));
  }
  return {
    publicId,
    name: row.name,
    createdAt: row.createdAt,
    viewCount: row.viewCount + (countView ? 1 : 0),
    savedTotalUzs: row.totalUzs,
    lines,
    build,
    check: checkBuild(build, perf),
  };
}

/** Событие воронки без привязки к сохранённой сборке (открыл конфигуратор, добавил в корзину). */
export async function trackEvent(
  db: Database,
  type: 'configurator_view' | 'build_to_cart' | 'build_shared' | 'build_pdf',
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(analyticsEvents).values({ type, payload });
}

export async function listUserBuilds(db: Database, userId: string) {
  return db
    .select({
      publicId: builds.publicId,
      name: builds.name,
      totalUzs: builds.totalUzs,
      compatStatus: builds.compatStatus,
      createdAt: builds.createdAt,
    })
    .from(builds)
    .where(eq(builds.userId, userId))
    .orderBy(desc(builds.createdAt))
    .limit(50);
}
