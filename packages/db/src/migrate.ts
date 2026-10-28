// Применяет миграции из ./migrations. Запуск: pnpm db:migrate
import { loadRootEnv, migrationDatabaseUrl } from './env';
import { runMigrations } from './migrator';

loadRootEnv();

const url = migrationDatabaseUrl();
if (!url) {
  console.error(
    '✖ Нет строки подключения. Укажи DATABASE_URL_UNPOOLED (или DATABASE_URL) в .env.local — см. .env.example.',
  );
  process.exit(1);
}

try {
  console.log(`→ Применяю миграции к ${new URL(url).host}…`);
  await runMigrations(url);
  console.log('✔ Миграции применены');
} catch (error) {
  console.error('✖ Ошибка миграции:', error);
  process.exitCode = 1;
}
