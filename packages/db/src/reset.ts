// Полный сброс dev-базы: удаляет все таблицы и заново применяет миграции.
// Запуск: pnpm db:reset -- --yes   (затем pnpm db:seed)
// Никогда не запускай на ветке main (продакшен) — данные будут удалены безвозвратно.
import { loadRootEnv, migrationDatabaseUrl } from './env';
import { dropAll, runMigrations } from './migrator';

loadRootEnv();

const url = migrationDatabaseUrl();
if (!url) {
  console.error('✖ Нет строки подключения — см. .env.example.');
  process.exit(1);
}

const host = new URL(url).host;
if (!process.argv.includes('--yes')) {
  console.error(`✖ Сброс удалит ВСЕ данные в ${host}. Подтверди флагом: pnpm db:reset -- --yes`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('✖ Сброс запрещён при NODE_ENV=production.');
  process.exit(1);
}

try {
  console.log(`→ Очищаю ${host}…`);
  await dropAll(url);
  console.log('→ Применяю миграции…');
  await runMigrations(url);
  console.log('✔ База пересоздана. Теперь: pnpm db:seed');
} catch (error) {
  console.error('✖ Ошибка сброса:', error);
  process.exitCode = 1;
}
