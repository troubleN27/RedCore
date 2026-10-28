import { inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import { buildSeedCatalog, searchTextFor } from './catalog';
import { categories as categorySeeds } from './data/categories';
import { deliveryZones, promoCodes, services } from './data/commerce';
import { demoReviews } from './data/reviews';
import { demoUsers, staffPassword } from './data/users';
import { hashPassword } from '@better-auth/utils/password';
import { games as gameSeeds, steamCover } from './data/games';
import { cpuPerf, gpuPerf } from './data/perf';
import { seedRate } from './pricing';

export type SeedDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface SeedStats {
  categories: number;
  brands: number;
  products: number;
  translations: number;
  prebuiltComponents: number;
  filters: number;
  perfGpu: number;
  perfCpu: number;
  games: number;
  deliveryZones: number;
  services: number;
  promoCodes: number;
  users: number;
}

/** Значение из вставляемой строки в ON CONFLICT DO UPDATE */
const excluded = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * Идемпотентный seed: повторный запуск обновляет цены, остатки и характеристики,
 * но не трогает рейтинги, резервы и переводы, отредактированные вручную или AI-агентом.
 * Работает с любым Postgres-драйвером Drizzle (Neon/pg в dev, PGlite в тестах).
 */
export async function seedDatabase(db: SeedDb, rate = seedRate()): Promise<SeedStats> {
  const { products } = buildSeedCatalog(rate);
  // scrypt — до транзакции, чтобы не держать её открытой
  const staffHash = await hashPassword(staffPassword());

  return db.transaction(async (tx) => {
    // ── Настройки ──
    const settingsRows = [
      {
        key: 'store',
        value: {
          name: 'RedCore',
          city: { ru: 'Ташкент', uz: 'Toshkent' },
          phone: '+998 71 200 00 00',
          email: 'hello@redcore.uz',
          hours: { open: '10:00', close: '20:00' },
        },
      },
      {
        key: 'pricing',
        value: { usdUzsRate: rate, rateSource: 'cbu', assemblyServiceUzs: 350_000 },
      },
      { key: 'fps_reference', value: { gpu: 'rtx-5070', cpu: 'ryzen-7-9800x3d' } },
    ];
    await tx
      .insert(schema.settings)
      .values(settingsRows)
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: excluded('value'), updatedAt: sql`now()` },
      });
    // Параметры модели FPS и AI меняются в консоли и калибровкой — повторный seed их не сбрасывает
    await tx
      .insert(schema.settings)
      .values([
        { key: 'fps_model', value: { k: 5 } },
        // AI-агенты: выключатель, лимиты сообщений и дневные бюджеты токенов (меняются в консоли)
        {
          key: 'ai',
          value: {
            enabled: true,
            guestPer10Min: 20,
            userPer10Min: 60,
            dailyTokensGuest: 60_000,
            dailyTokensUser: 250_000,
            maxMessageChars: 2000,
          },
        },
      ])
      .onConflictDoNothing({ target: schema.settings.key });

    // ── Категории и переводы ──
    const categoryRows = await tx
      .insert(schema.categories)
      .values(
        categorySeeds.map((c, index) => ({
          slug: c.slug,
          kind: c.kind,
          componentType: c.type,
          sort: index,
          icon: c.icon,
        })),
      )
      .onConflictDoUpdate({
        target: schema.categories.slug,
        set: {
          kind: excluded('kind'),
          componentType: excluded('component_type'),
          sort: excluded('sort'),
          icon: excluded('icon'),
        },
      })
      .returning({ id: schema.categories.id, slug: schema.categories.slug });
    const categoryId = new Map(categoryRows.map((row) => [row.slug, row.id]));

    await tx
      .insert(schema.categoryTranslations)
      .values(
        categorySeeds.flatMap((c) =>
          (['ru', 'uz'] as const).map((locale) => ({
            categoryId: categoryId.get(c.slug)!,
            locale,
            name: c[locale].name,
            description: c[locale].description,
          })),
        ),
      )
      .onConflictDoUpdate({
        target: [schema.categoryTranslations.categoryId, schema.categoryTranslations.locale],
        set: { name: excluded('name'), description: excluded('description') },
      });

    const filterRows = categorySeeds.flatMap((c) =>
      c.filters.map((f, sort) => ({
        categoryId: categoryId.get(c.slug)!,
        specKey: f.key,
        type: f.type,
        unit: f.unit ?? null,
        sort,
        isCompatibilityKey: f.compat ?? false,
      })),
    );
    await tx
      .insert(schema.categoryFilters)
      .values(filterRows)
      .onConflictDoUpdate({
        target: [schema.categoryFilters.categoryId, schema.categoryFilters.specKey],
        set: {
          type: excluded('type'),
          unit: excluded('unit'),
          sort: excluded('sort'),
          isCompatibilityKey: excluded('is_compatibility_key'),
        },
      });

    // ── Бренды ──
    const brandNames = [...new Set(products.map((p) => p.brand))].sort();
    const slugOf = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const brandRows = await tx
      .insert(schema.brands)
      .values(brandNames.map((name) => ({ slug: slugOf(name), name })))
      .onConflictDoUpdate({ target: schema.brands.slug, set: { name: excluded('name') } })
      .returning({ id: schema.brands.id, name: schema.brands.name });
    const brandId = new Map(brandRows.map((row) => [row.name, row.id]));

    // ── Индексы производительности ──
    await tx
      .insert(schema.perfGpu)
      .values(
        gpuPerf.map((g) => ({
          key: g.key,
          name: g.name,
          vendor: g.vendor,
          index1080: g.index1080,
          index1440: g.index1440,
          index2160: g.index2160,
          rtIndex: g.rtIndex,
          frameGen: g.frameGen,
          upscalers: g.upscalers,
          vramGb: g.vramGb,
        })),
      )
      .onConflictDoUpdate({
        target: schema.perfGpu.key,
        set: {
          name: excluded('name'),
          index1080: excluded('index1080'),
          index1440: excluded('index1440'),
          index2160: excluded('index2160'),
          rtIndex: excluded('rt_index'),
          frameGen: excluded('frame_gen'),
          upscalers: excluded('upscalers'),
          vramGb: excluded('vram_gb'),
        },
      });
    await tx
      .insert(schema.perfCpu)
      .values(cpuPerf)
      .onConflictDoUpdate({
        target: schema.perfCpu.key,
        set: {
          name: excluded('name'),
          gamingIndex: excluded('gaming_index'),
          multiThreadIndex: excluded('multi_thread_index'),
        },
      });

    // ── Игры калькулятора FPS ──
    // Только добавление: коэффициенты и замеры, исправленные в консоли или калибровкой, seed не затирает
    const gameRows = await tx
      .insert(schema.games)
      .values(
        gameSeeds.map((g) => ({
          slug: g.slug,
          name: g.name,
          steamAppId: g.steamAppId,
          coverUrl: steamCover(g.steamAppId),
          hue: g.hue,
          profile: g.profile,
          cpuAlpha: g.cpuAlpha,
          vendorBias: g.vendorBias,
          ramMinGb: g.ramMinGb,
          ramRecGb: g.ramRecGb,
          supports: g.supports,
          thresholds: g.thresholds,
          lowRatio: g.lowRatio,
          fpsCap: g.fpsCap,
          sort: g.sort,
        })),
      )
      .onConflictDoNothing({ target: schema.games.slug })
      .returning({ id: schema.games.id, slug: schema.games.slug });
    const newGames = new Map(gameRows.map((row) => [row.slug, row.id]));
    const fresh = gameSeeds.filter((g) => newGames.has(g.slug));
    if (fresh.length > 0) {
      await tx.insert(schema.gameBenchmarks).values(
        fresh.flatMap((g) =>
          (['1080p', '1440p', '2160p'] as const).flatMap((resolution) =>
            (['low', 'medium', 'high', 'ultra'] as const).map((preset) => ({
              gameId: newGames.get(g.slug)!,
              resolution,
              preset,
              refFpsGpu: g.gpuFps[resolution][preset],
              vramReqGb: g.vramGb[resolution][preset],
            })),
          ),
        ),
      );
      await tx.insert(schema.gameCpuCaps).values(
        fresh.flatMap((g) =>
          (['low', 'medium', 'high', 'ultra'] as const).map((preset) => ({
            gameId: newGames.get(g.slug)!,
            preset,
            refFpsCpu: g.cpuFps[preset],
          })),
        ),
      );
    }

    // ── Товары ──
    const productRows = await tx
      .insert(schema.products)
      .values(
        products.map((p) => ({
          sku: p.sku,
          slug: p.slug,
          categoryId: categoryId.get(p.categorySlug)!,
          brandId: brandId.get(p.brand)!,
          componentType: p.componentType,
          name: p.name,
          status: 'active' as const,
          priceUzs: p.priceUzs,
          compareAtPriceUzs: p.compareAtPriceUzs,
          stockQty: p.stockQty,
          warrantyMonths: p.warrantyMonths,
          specs: p.specs,
          perfKey: p.perfKey ?? null,
          searchText: searchTextFor(p),
          isFeatured: p.featured,
        })),
      )
      .onConflictDoUpdate({
        target: schema.products.slug,
        set: {
          sku: excluded('sku'),
          categoryId: excluded('category_id'),
          brandId: excluded('brand_id'),
          componentType: excluded('component_type'),
          name: excluded('name'),
          priceUzs: excluded('price_uzs'),
          compareAtPriceUzs: excluded('compare_at_price_uzs'),
          stockQty: excluded('stock_qty'),
          warrantyMonths: excluded('warranty_months'),
          specs: excluded('specs'),
          perfKey: excluded('perf_key'),
          isFeatured: excluded('is_featured'),
          searchText: excluded('search_text'),
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: schema.products.id, slug: schema.products.slug });
    const productId = new Map(productRows.map((row) => [row.slug, row.id]));

    const translations = products.flatMap((p) =>
      (['ru', 'uz'] as const).map((locale) => ({
        productId: productId.get(p.slug)!,
        locale,
        shortDescription: p.shortDescription[locale],
        source: 'template' as const,
      })),
    );
    await tx
      .insert(schema.productTranslations)
      .values(translations)
      .onConflictDoUpdate({
        target: [schema.productTranslations.productId, schema.productTranslations.locale],
        set: { shortDescription: excluded('short_description') },
        // Ручные и AI-тексты (после ревью) seed не перезаписывает
        setWhere: sql`${schema.productTranslations.source} = 'template'`,
      });

    // ── Состав готовых сборок ──
    const prebuilts = products.filter((p) => p.components);
    const prebuiltIds = prebuilts.map((p) => productId.get(p.slug)!);
    await tx
      .delete(schema.prebuiltComponents)
      .where(inArray(schema.prebuiltComponents.prebuiltId, prebuiltIds));
    const componentRows = prebuilts.flatMap((p) =>
      p.components!.map((c) => ({
        prebuiltId: productId.get(p.slug)!,
        componentId: productId.get(c.slug)!,
        qty: c.qty,
      })),
    );
    await tx.insert(schema.prebuiltComponents).values(componentRows);

    // ── Доставка, услуги, промокоды ──
    await tx
      .insert(schema.deliveryZones)
      .values(
        deliveryZones.map((z, sort) => ({
          code: z.code,
          name: z.name,
          priceUzs: z.priceUzs,
          freeFromUzs: z.freeFromUzs ?? null,
          etaMinDays: z.eta[0],
          etaMaxDays: z.eta[1],
          codAllowed: z.codAllowed ?? true,
          isPickup: z.isPickup ?? false,
          sort,
        })),
      )
      .onConflictDoUpdate({
        target: schema.deliveryZones.code,
        set: {
          name: excluded('name'),
          priceUzs: excluded('price_uzs'),
          freeFromUzs: excluded('free_from_uzs'),
          etaMinDays: excluded('eta_min_days'),
          etaMaxDays: excluded('eta_max_days'),
          codAllowed: excluded('cod_allowed'),
          isPickup: excluded('is_pickup'),
          sort: excluded('sort'),
        },
      });

    await tx
      .insert(schema.services)
      .values(services)
      .onConflictDoUpdate({
        target: schema.services.key,
        set: {
          name: excluded('name'),
          description: excluded('description'),
          priceUzs: excluded('price_uzs'),
        },
      });

    await tx
      .insert(schema.promoCodes)
      .values(promoCodes.map((p) => ({ ...p, code: p.code.toUpperCase() })))
      .onConflictDoNothing({ target: schema.promoCodes.code });

    // ── Демо-пользователи: вход по коду из письма/SMS (в dev — /ru/dev/inbox) ──
    await tx
      .insert(schema.user)
      .values(demoUsers.map((u) => ({ ...u, emailVerified: true, phoneNumberVerified: true })))
      .onConflictDoUpdate({ target: schema.user.id, set: { role: excluded('role') } });

    // Персонал входит в админку по паролю + TOTP (2FA подключается при первом входе)
    await tx
      .insert(schema.account)
      .values(
        demoUsers
          .filter((u) => u.role !== 'customer')
          .map((u) => ({
            id: `${u.id}-credential`,
            accountId: u.id,
            providerId: 'credential',
            userId: u.id,
            password: staffHash,
          })),
      )
      .onConflictDoNothing();

    // ── Отзывы ──
    const existingReviews = await tx
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .limit(1);
    if (existingReviews.length === 0) {
      const reviewRows = demoReviews
        .filter((r) => productId.has(r.slug))
        .map(({ slug, ...r }) => ({ ...r, productId: productId.get(slug)!, verifiedPurchase: 1 }));
      if (reviewRows.length > 0) await tx.insert(schema.reviews).values(reviewRows);
      // Рейтинг товаров с отзывами — по опубликованным отзывам
      for (const id of new Set(reviewRows.map((r) => r.productId))) {
        await tx.execute(sql`
          update products set
            rating_avg = coalesce((select avg(rating) from reviews where product_id = ${id} and status = 'approved'), 0),
            rating_count = (select count(*) from reviews where product_id = ${id} and status = 'approved')
          where id = ${id}`);
      }
    }

    return {
      categories: categoryRows.length,
      brands: brandRows.length,
      products: productRows.length,
      translations: translations.length,
      prebuiltComponents: componentRows.length,
      filters: filterRows.length,
      perfGpu: gpuPerf.length,
      perfCpu: cpuPerf.length,
      games: gameSeeds.length,
      deliveryZones: deliveryZones.length,
      services: services.length,
      promoCodes: promoCodes.length,
      users: demoUsers.length,
    };
  });
}
