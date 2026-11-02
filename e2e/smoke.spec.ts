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

test('о компании: из секции главной и на узбекском', async ({ page }) => {
  await page.goto('/ru');
  await page.getByRole('link', { name: 'Узнать больше' }).click();
  await expect(page).toHaveURL(/\/ru\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('О компании RedCore');
  await page.goto('/uz/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RedCore kompaniyasi haqida');
});

test('подвал: столбец REDCORE ведёт на страницы компании', async ({ page }) => {
  const links = [
    ['О нас', /\/ru\/about$/, 'О компании RedCore'],
    ['Контакты', /\/ru\/contacts$/, 'Контакты'],
    ['Почему RedCore?', /\/ru\/why-redcore$/, 'Почему REDCORE'],
    ['Публичная оферта', /\/ru\/offer$/, 'Публичная оферта'],
    ['Политика конфиденциальности', /\/ru\/privacy$/, 'Политика конфиденциальности'],
  ] as const;
  for (const [name, url, heading] of links) {
    await page.goto('/ru');
    await page.getByRole('contentinfo').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
  await page.goto('/uz/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maxfiylik siyosati');
  await page.getByRole('main').getByRole('link', { name: 'Ommaviy oferta' }).click();
  await expect(page).toHaveURL(/\/uz\/offer$/);
});

test('FAQ: из подвала, ответ раскрывается, на узбекском', async ({ page }) => {
  await page.goto('/ru');
  await page.getByRole('contentinfo').getByRole('link', { name: 'FAQ' }).click();
  await expect(page).toHaveURL(/\/ru\/faq$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Частые вопросы');
  const answer = page.getByText('Во все 14 регионов Узбекистана', { exact: false });
  await expect(answer).toBeHidden();
  await page.getByText('Куда вы доставляете?').click();
  await expect(answer).toBeVisible();
  await page.goto('/uz/faq');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Koʻp beriladigan savollar');
});

test('новинки: кнопка на главной ведёт на страницу новинок', async ({ page }) => {
  await page.goto('/ru');
  await page.getByRole('link', { name: 'Все новинки' }).click();
  await expect(page).toHaveURL(/\/ru\/new$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новинки');
  await expect(page.getByRole('heading', { level: 2, name: 'Видеокарты' })).toBeVisible();
});

test('отзывы на главной: карточки и сводка', async ({ page }) => {
  await page.goto('/ru');
  const section = page.locator('section[aria-labelledby="home-reviews"]');
  await expect(
    section.getByRole('heading', { name: 'Нам доверяют геймеры и профи' }),
  ).toBeVisible();
  await expect(section.getByRole('listitem')).not.toHaveCount(0);
  await expect(section.getByText('Средняя оценка')).toBeVisible();
});

test('health отвечает', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true });
});

test('страницы для покупателей: из подвала, с таблицей зон доставки и на узбекском', async ({
  page,
}) => {
  await page.goto('/ru');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Доставка' }).click();
  await expect(page).toHaveURL(/\/ru\/help\/delivery$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Доставка');
  await expect(page.getByTestId('delivery-zones').locator('tbody tr')).not.toHaveCount(0);
  await page.getByRole('link', { name: 'Гарантия' }).first().click();
  await expect(page.getByTestId('help-warranty')).toBeVisible();
  await page.goto('/uz/help/returns');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qaytarish');
  expect((await page.goto('/ru/help/nichego'))?.status()).toBe(404);
});
