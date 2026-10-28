import { expect, test } from '@playwright/test';

test.describe('каталог', () => {
  test('категория фильтруется по сокету через URL и чекбоксы', async ({ page, isMobile }) => {
    test.skip(isMobile, 'фильтры на мобильном — в выезжающей панели');
    await page.goto('/ru/catalog/cpu?socket=AM5');
    await expect(page.getByText('Найдено: 11 товаров').first()).toBeVisible();
    await page.locator('[id="f-socket-LGA1700"]').first().click();
    await expect(page).toHaveURL(/socket=AM5%2CLGA1700/);
    await expect(page.getByText('Найдено: 17 товаров').first()).toBeVisible();
  });

  test('диапазон длины видеокарты и сортировка по цене', async ({ page }) => {
    await page.goto('/ru/catalog/gpu?lengthMm=-250&sort=price-asc');
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(24);
  });

  test('карточка товара: характеристики, совместимое и JSON-LD', async ({ page }) => {
    await page.goto('/ru/p/amd-ryzen-7-9800x3d');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ryzen 7 9800X3D');
    await expect(page.getByText('6 420 000 сум').first()).toBeVisible();
    await expect(page.getByTestId('compatible-motherboard')).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    // Product и BreadcrumbList идут одним массивом
    expect(JSON.parse(jsonLd!)[0]).toMatchObject({
      '@type': 'Product',
      offers: { priceCurrency: 'UZS', price: 6420000 },
    });
  });

  test('узбекская карточка — без кириллицы', async ({ page }) => {
    await page.goto('/uz/p/amd-ryzen-7-9800x3d');
    const text = await page.locator('main').innerText();
    expect(text).toContain('soʻm');
    expect(/[Ѐ-ӿ]/.test(text)).toBe(false);
  });

  test('поиск: автодополнение и страница результатов', async ({ page, isMobile }) => {
    test.skip(isMobile, 'на мобильном поиск открывается отдельной страницей');
    await page.goto('/ru');
    const box = page.getByRole('combobox', { name: 'Поиск по каталогу' }).first();
    await box.fill('видюха 5070');
    await expect(page.getByRole('option').first()).toContainText('Видеокарты');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/ru\/search\?q=/);
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('сравнение и избранное сохраняются между страницами', async ({ page }) => {
    await page.goto('/ru/catalog/gpu');
    const cards = page.getByTestId('product-card');
    await cards.nth(0).getByRole('button', { name: 'Сравнить' }).click();
    await cards.nth(1).getByRole('button', { name: 'Сравнить' }).click();
    await cards.nth(2).getByRole('button', { name: 'В избранное' }).click();
    await page.goto('/ru/compare');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await expect(page.locator('table thead th')).toHaveCount(3);
    await page.goto('/ru/favorites');
    await expect(page.getByTestId('product-card')).toHaveCount(1);
  });

  test('неизвестная категория и товар — 404', async ({ page }) => {
    expect((await page.goto('/ru/catalog/laptops'))?.status()).toBe(404);
    expect((await page.goto('/ru/p/no-such-product'))?.status()).toBe(404);
  });
});

test('sitemap и robots', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/ru/p/amd-ryzen-7-9800x3d');
  expect(sitemap).toContain('/uz/catalog/gpu');
  expect(sitemap).toContain('hreflang="uz"');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /api/');
});
