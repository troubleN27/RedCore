// Только отзывы из демо-данных: добавляет те, которых ещё нет (по товару и автору), и
// пересчитывает рейтинг этих товаров. Остальное в базе не трогает. Запуск: pnpm db:reviews
import { and, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { demoReviews } from './data/reviews';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  const products = await db
    .select({ id: schema.products.id, slug: schema.products.slug })
    .from(schema.products)
    .where(inArray(schema.products.slug, [...new Set(demoReviews.map((r) => r.slug))]));
  const productId = new Map(products.map((p) => [p.slug, p.id]));

  const added: string[] = [];
  for (const { slug, ...review } of demoReviews) {
    const id = productId.get(slug);
    if (!id) continue;
    const [existing] = await db
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(
        and(eq(schema.reviews.productId, id), eq(schema.reviews.authorName, review.authorName)),
      )
      .limit(1);
    if (existing) continue;
    await db.insert(schema.reviews).values({ ...review, productId: id, verifiedPurchase: 1 });
    added.push(`${review.authorName} → ${slug}`);
  }

  for (const id of new Set(products.map((p) => p.id))) {
    await db.execute(sql`
      update products set
        rating_avg = coalesce((select avg(rating) from reviews where product_id = ${id} and status = 'approved'), 0),
        rating_count = (select count(*) from reviews where product_id = ${id} and status = 'approved')
      where id = ${id}`);
  }

  console.log(`→ ${new URL(url).host}`);
  console.log(
    added.length > 0
      ? `✔ Добавлено отзывов: ${added.length}\n  ${added.join('\n  ')}`
      : '✔ Новых отзывов нет — все уже в базе',
  );
} catch (error) {
  console.error('✖ Ошибка:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
