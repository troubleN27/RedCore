// Демо-данные: ~200 товаров, индексы производительности, доставка, услуги, промокоды.
// Запуск: pnpm db:seed (идемпотентно — повторный запуск обновляет цены, остатки и характеристики).
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { seedRate } from './pricing';
import { seedDatabase } from './seed';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  const rate = seedRate();
  console.log(`→ Seed: ${new URL(url).host}, курс ${rate} сум/$`);
  const startedAt = Date.now();
  const stats = await seedDatabase(db, rate);
  console.log(`✔ Seed завершён за ${((Date.now() - startedAt) / 1000).toFixed(1)} с`);
  console.table(stats);
} catch (error) {
  console.error('✖ Ошибка seed:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
