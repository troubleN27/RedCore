import {
  brands,
  categories,
  categoryTranslations,
  inventoryMovements,
  orders,
  productTranslations,
  products,
  promoCodes,
  reviews,
  type Database,
} from '@redcore/db';
import {
  buildSearchText,
  normalizePromoCode,
  safeParseSpecs,
  specKeyOrder,
  type ComponentType,
} from '@redcore/domain';
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { invalidateCatalogCache } from '../catalog/snapshot';
import { ADMIN_PAGE_SIZE } from './orders';

export class AdminValidationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Invalid fields: ${fields.join(', ')}`);
  }
}

/** JSON с отсортированными ключами: порядок полей в jsonb и в форме может отличаться. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

// ── Товары ──

export async function listAdminProducts(
  db: Database,
  filter: { q?: string; category?: string; status?: string; page?: number },
) {
  const page = Math.max(1, filter.page ?? 1);
  const conditions: SQL[] = [];
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    conditions.push(
      or(ilike(products.name, like), ilike(products.sku, like), ilike(brands.name, like))!,
    );
  }
  if (filter.category) conditions.push(eq(categories.slug, filter.category));
  if (filter.status === 'draft' || filter.status === 'active' || filter.status === 'archived') {
    conditions.push(eq(products.status, filter.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        slug: products.slug,
        name: products.name,
        brand: brands.name,
        categorySlug: categories.slug,
        componentType: products.componentType,
        priceUzs: products.priceUzs,
        stockQty: products.stockQty,
        reservedQty: products.reservedQty,
        status: products.status,
        isFeatured: products.isFeatured,
      })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(asc(categories.sort), asc(products.name))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db
      .select({ n: count() })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
  ]);
  return {
    rows,
    total: total?.n ?? 0,
    page,
    pages: Math.max(1, Math.ceil((total?.n ?? 0) / ADMIN_PAGE_SIZE)),
  };
}

export async function listCategoryOptions(db: Database, locale: 'ru' | 'uz') {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      componentType: categories.componentType,
      name: categoryTranslations.name,
    })
    .from(categories)
    .innerJoin(
      categoryTranslations,
      and(
        eq(categoryTranslations.categoryId, categories.id),
        eq(categoryTranslations.locale, locale),
      ),
    )
    .orderBy(asc(categories.sort));
}

export async function listBrandOptions(db: Database) {
  return db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name));
}

export async function getAdminProduct(db: Database, id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const translations = await db
    .select()
    .from(productTranslations)
    .where(eq(productTranslations.productId, id));
  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.productId, id))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(20);
  return {
    product,
    ru: translations.find((t) => t.locale === 'ru') ?? null,
    uz: translations.find((t) => t.locale === 'uz') ?? null,
    movements,
    specKeys: specKeyOrder(product.componentType),
  };
}

const money = z.number().int().min(0).max(10_000_000_000);

export const productInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9-]+$/),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(160),
  brandId: z.uuid(),
  categoryId: z.uuid(),
  priceUzs: money.min(1),
  compareAtPriceUzs: money.nullable(),
  costUzs: money.nullable(),
  status: z.enum(['draft', 'active', 'archived']),
  isFeatured: z.boolean(),
  warrantyMonths: z.number().int().min(0).max(120),
  specs: z.record(z.string(), z.unknown()),
  shortRu: z.string().trim().max(300),
  shortUz: z.string().trim().max(300),
  descriptionRu: z.string().trim().max(5000).nullable(),
  descriptionUz: z.string().trim().max(5000).nullable(),
});
export type ProductInput = z.input<typeof productInputSchema>;

/**
 * Создание и правка товара. Характеристики проверяются той же Zod-схемой категории,
 * что и в движке совместимости, — некорректные данные в каталог не попадут.
 */
export async function saveProduct(
  db: Database,
  input: ProductInput,
  id?: string,
): Promise<{ id: string; diff: Record<string, unknown> }> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success)
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  const data = parsed.data;
  const [category] = await db.select().from(categories).where(eq(categories.id, data.categoryId));
  const [brand] = await db.select().from(brands).where(eq(brands.id, data.brandId));
  if (!category || !brand) throw new AdminValidationError(['categoryId']);
  const type = category.componentType as ComponentType;
  const specs = safeParseSpecs(type, data.specs);
  if (!specs.success)
    throw new AdminValidationError(specs.error.issues.map((i) => `specs.${i.path.join('.')}`));

  const values = {
    sku: data.sku,
    slug: data.slug,
    name: data.name,
    brandId: data.brandId,
    categoryId: data.categoryId,
    componentType: type,
    priceUzs: data.priceUzs,
    compareAtPriceUzs: data.compareAtPriceUzs,
    costUzs: data.costUzs,
    status: data.status,
    isFeatured: data.isFeatured,
    warrantyMonths: data.warrantyMonths,
    specs: specs.data as never,
    searchText: buildSearchText({
      brand: brand.name,
      name: data.name,
      sku: data.sku,
      keywords: [],
    }),
  };

  const result = await db.transaction(async (tx) => {
    let productId = id;
    let diff: Record<string, unknown> = {};
    if (id) {
      const [before] = await tx.select().from(products).where(eq(products.id, id));
      if (!before) throw new AdminValidationError(['id']);
      for (const key of [
        'sku',
        'slug',
        'name',
        'priceUzs',
        'compareAtPriceUzs',
        'costUzs',
        'status',
        'isFeatured',
        'warrantyMonths',
      ] as const) {
        if (before[key] !== values[key]) diff[key] = { from: before[key], to: values[key] };
      }
      if (stableJson(before.specs) !== stableJson(values.specs)) diff.specs = 'changed';
      await tx
        .update(products)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(products.id, id));
    } else {
      const [created] = await tx.insert(products).values(values).returning({ id: products.id });
      productId = created!.id;
      diff = { created: data.sku };
    }
    for (const [locale, short, description] of [
      ['ru', data.shortRu, data.descriptionRu],
      ['uz', data.shortUz, data.descriptionUz],
    ] as const) {
      await tx
        .insert(productTranslations)
        .values({
          productId: productId!,
          locale,
          shortDescription: short,
          description,
          source: 'human',
          reviewedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [productTranslations.productId, productTranslations.locale],
          set: { shortDescription: short, description, source: 'human', reviewedAt: new Date() },
        });
    }
    return { id: productId!, diff };
  });
  invalidateCatalogCache();
  return result;
}

/** Корректировка остатка: приход (+) или списание (−); ниже текущего резерва опуститься нельзя. */
export async function adjustStock(
  db: Database,
  productId: string,
  delta: number,
  note: string,
): Promise<{ stockQty: number }> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000)
    throw new AdminValidationError(['delta']);
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${delta}` })
      .where(
        and(
          eq(products.id, productId),
          sql`${products.stockQty} + ${delta} >= ${products.reservedQty}`,
        ),
      )
      .returning({ stockQty: products.stockQty });
    if (!row) throw new AdminValidationError(['delta']);
    await tx.insert(inventoryMovements).values({
      productId,
      delta,
      reason: delta > 0 ? 'restock' : 'adjust',
      note: note.trim() || null,
    });
    return row;
  });
  invalidateCatalogCache();
  return result;
}

export async function listMovements(db: Database, page = 1) {
  return db
    .select({
      id: inventoryMovements.id,
      createdAt: inventoryMovements.createdAt,
      delta: inventoryMovements.delta,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      orderNumber: orders.number,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(orders, eq(orders.id, inventoryMovements.orderId))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(ADMIN_PAGE_SIZE * 2)
    .offset((Math.max(1, page) - 1) * ADMIN_PAGE_SIZE * 2);
}

export async function listLowStock(db: Database, threshold = 3) {
  const available = sql<number>`(${products.stockQty} - ${products.reservedQty})::int`;
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stockQty: products.stockQty,
      reservedQty: products.reservedQty,
      available,
    })
    .from(products)
    .where(
      and(
        eq(products.status, 'active'),
        sql`${products.stockQty} - ${products.reservedQty} <= ${threshold}`,
      ),
    )
    .orderBy(available, products.sku);
}

// ── Отзывы ──

export async function listReviews(db: Database, status: 'pending' | 'approved' | 'rejected') {
  return db
    .select({ review: reviews, productName: products.name, productSlug: products.slug })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.status, status))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
}

async function recomputeRating(db: Database, productId: string) {
  await db
    .update(products)
    .set({
      ratingAvg: sql`coalesce((select avg(rating) from ${reviews} where ${reviews.productId} = ${productId} and ${reviews.status} = 'approved'), 0)`,
      ratingCount: sql`(select count(*) from ${reviews} where ${reviews.productId} = ${productId} and ${reviews.status} = 'approved')::int`,
    })
    .where(eq(products.id, productId));
}

export async function moderateReview(
  db: Database,
  id: string,
  status: 'approved' | 'rejected',
  staffId: string,
) {
  const [row] = await db
    .update(reviews)
    .set({ status, moderatedBy: staffId, moderatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning({ productId: reviews.productId });
  if (row) {
    await recomputeRating(db, row.productId);
    invalidateCatalogCache();
  }
  return row ?? null;
}

/** Опубликованные отзывы на языке страницы: на uz-версии не должно быть русского текста. */
export async function getApprovedReviews(db: Database, productId: string, locale: 'ru' | 'uz') {
  return db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.status, 'approved'),
        eq(reviews.locale, locale),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(20);
}

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(2000),
  pros: z.string().trim().max(300).optional(),
  cons: z.string().trim().max(300).optional(),
});

/** Отзыв покупателя уходит на модерацию; «покупка подтверждена» — если товар был в его оплаченном заказе. */
export async function submitReview(
  db: Database,
  input: z.input<typeof reviewInputSchema> & {
    productId: string;
    userId: string;
    authorName: string;
    locale: string;
  },
) {
  const data = reviewInputSchema.parse(input);
  const [purchase] = await db
    .execute(
      sql`
    select o.id from orders o join order_items i on i.order_id = o.id
    where o.user_id = ${input.userId} and i.product_id = ${input.productId} and o.payment_status = 'paid'
    limit 1`,
    )
    .then((r) => (r as unknown as { rows: { id: string }[] }).rows);
  const [row] = await db
    .insert(reviews)
    .values({
      productId: input.productId,
      userId: input.userId,
      authorName: input.authorName,
      locale: input.locale,
      ...data,
      verifiedPurchase: purchase ? 1 : 0,
      orderId: purchase?.id ?? null,
    })
    .returning();
  return row!;
}

// ── Промокоды ──

export async function listPromos(db: Database) {
  return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
}

export const promoInputSchema = z.object({
  code: z.string().trim().min(3).max(32),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  minOrderUzs: money.nullable(),
  maxDiscountUzs: money.nullable(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  usageLimit: z.number().int().min(1).nullable(),
  perUserLimit: z.number().int().min(1).nullable(),
  isActive: z.boolean(),
  descriptionRu: z.string().trim().max(200),
  descriptionUz: z.string().trim().max(200),
});

export async function createPromo(db: Database, input: z.input<typeof promoInputSchema>) {
  const parsed = promoInputSchema.safeParse(input);
  if (!parsed.success)
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  const data = parsed.data;
  if (data.type === 'percent' && data.value > 100) throw new AdminValidationError(['value']);
  const code = normalizePromoCode(data.code);
  const [exists] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, code));
  if (exists) throw new AdminValidationError(['code']);
  const [row] = await db
    .insert(promoCodes)
    .values({
      code,
      type: data.type,
      value: data.value,
      minOrderUzs: data.minOrderUzs,
      maxDiscountUzs: data.maxDiscountUzs,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      perUserLimit: data.perUserLimit,
      isActive: data.isActive,
      description: { ru: data.descriptionRu, uz: data.descriptionUz },
    })
    .returning();
  return row!;
}

export async function setPromoActive(db: Database, id: string, isActive: boolean) {
  const [row] = await db
    .update(promoCodes)
    .set({ isActive })
    .where(eq(promoCodes.id, id))
    .returning({ code: promoCodes.code });
  return row ?? null;
}
