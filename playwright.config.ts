import { defineConfig, devices } from '@playwright/test';

const port = 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // В CI: имя каждого теста в логе (видно, где зависло), аннотации и HTML-отчёт в артефактах
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  // Зависший тест не должен съедать всё время задания: отчёт успеет выгрузиться
  globalTimeout: process.env.CI ? 30 * 60_000 : 0,
  // reducedMotion: сайт отключает плавные прокрутки и анимации — клики не попадают в движущиеся цели
  use: { baseURL, trace: 'on-first-retry', reducedMotion: 'reduce' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Локально переиспользует уже запущенный `pnpm dev`; в CI поднимает продакшен-сборку
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Вебхук Telegram в продакшен-сборке открыт только с секретом (в dev — встроенный dev-секрет)
    env: { TELEGRAM_WEBHOOK_SECRET: 'e2e-telegram-secret' },
  },
});
