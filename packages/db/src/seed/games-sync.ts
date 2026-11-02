// Игры калькулятора FPS в рабочей базе: новые игры из демо-данных, недостающие обложки,
// удаление игр E2E-теста. Замеры, исправленные в консоли, не трогает. Запуск: pnpm db:games
import { createDatabase } from '../client';
import { loadRootEnv } from '../env';
import { syncGames } from './games';

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✖ DATABASE_URL не задан — см. .env.example.');
  process.exit(1);
}

const db = createDatabase(url);
try {
  console.log(`→ ${new URL(url).host}`);
  const stats = await syncGames(db);
  console.log(`✔ Добавлены игры: ${stats.added.join(', ') || 'нет'}`);
  console.log(`✔ Обложки: ${stats.coversSet.join(', ') || 'все на месте'}`);
  console.log(`✔ Удалено тестовых игр: ${stats.testGamesRemoved}`);
} catch (error) {
  console.error('✖ Ошибка:', error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
