// Обновление каталога без потери правок: новые разделы, фильтры и товары добавляются, у прежних
// товаров цены, остатки и тексты не меняются. Подходит для рабочей базы. Запуск: pnpm db:catalog-sync
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { syncCatalog } from './sync';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  console.log(`→ ${new URL(url).host}`);
  const stats = await syncCatalog(db);
  console.log(`✔ Новые разделы: ${stats.categoriesAdded.join(', ') || 'нет'}`);
  console.log(`✔ Добавлено товаров: ${stats.productsAdded}`);
  console.log(`✔ Перенесено в другой раздел: ${stats.productsMoved.join(', ') || 'нет'}`);
} catch (error) {
  console.error('✖ Ошибка:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
