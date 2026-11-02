// Только промокоды из демо-данных: добавляет новые, существующие не трогает (цены, остатки
// и всё остальное в базе остаются как есть). Запуск: pnpm db:promos
import * as schema from '../schema';
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { promoCodes } from './data/commerce';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  const added = await db
    .insert(schema.promoCodes)
    .values(promoCodes.map((p) => ({ ...p, code: p.code.toUpperCase() })))
    .onConflictDoNothing({ target: schema.promoCodes.code })
    .returning({ code: schema.promoCodes.code });
  console.log(`→ ${new URL(url).host}`);
  console.log(
    added.length > 0
      ? `✔ Добавлены промокоды: ${added.map((p) => p.code).join(', ')}`
      : '✔ Новых промокодов нет — все уже в базе',
  );
} catch (error) {
  console.error('✖ Ошибка:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
