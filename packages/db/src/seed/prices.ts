// Обновление цен и меток «Хит» в базе по демо-данным (цены магазинов Ташкента из
// data/market-prices.ts). Остатки, тексты и всё остальное не трогает.
// Ручные правки цен в админке будут перезаписаны. Запуск: pnpm db:prices
import { eq, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { buildSeedCatalog } from './catalog';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  console.log(`→ ${new URL(url).host}`);
  const { products } = buildSeedCatalog();
  let changed = 0;
  await db.transaction(async (tx) => {
    const current = new Map(
      (
        await tx
          .select({
            slug: schema.products.slug,
            price: schema.products.priceUzs,
            compareAt: schema.products.compareAtPriceUzs,
            featured: schema.products.isFeatured,
          })
          .from(schema.products)
      ).map((row) => [row.slug, row]),
    );
    for (const p of products) {
      const row = current.get(p.slug);
      if (
        !row ||
        (row.price === p.priceUzs &&
          row.compareAt === p.compareAtPriceUzs &&
          row.featured === p.featured)
      )
        continue;
      await tx
        .update(schema.products)
        .set({
          priceUzs: p.priceUzs,
          compareAtPriceUzs: p.compareAtPriceUzs,
          isFeatured: p.featured,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.products.slug, p.slug));
      changed++;
    }
  });
  console.log(`✔ Обновлены цены и метки «Хит»: ${changed} товаров`);
} catch (error) {
  console.error('✖ Ошибка:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
