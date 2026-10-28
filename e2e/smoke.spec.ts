import { expect, test } from '@playwright/test';
import { messages } from '../packages/i18n/src/messages';

test.describe('локализация', () => {
  test('корень без uz в Accept-Language ведёт на /ru', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/ru$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.ru.home.hero.title);
    await context.close();
  });

  test('Accept-Language uz ведёт на /uz', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'uz-UZ' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/uz$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'uz-Latn');
    await context.close();
  });

  test('переключатель меняет язык и запоминает выбор', async ({ page, isMobile }) => {
    test.skip(isMobile, 'на мобильном переключатель в меню');
    await page.goto('/ru');
    await page.getByRole('button', { name: 'UZ' }).click();
    await expect(page).toHaveURL(/\/uz$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.uz.home.hero.title);
    await page.goto('/');
    await expect(page).toHaveURL(/\/uz$/);
  });
});

test('неизвестная страница — локализованная 404', async ({ page }) => {
  const response = await page.goto('/ru/takoy-stranicy-net');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    messages.ru.errors.notFound.title,
  );
});

test('health отвечает', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true });
});
