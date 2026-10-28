import { expect, type APIRequestContext, type Page } from '@playwright/test';

// Покупка в магазине для E2E: корзина через localStorage и оформление заказа в форме checkout.

let phoneSeq = 0;
/** Уникальный номер на тест: промокоды «на первый заказ» и лимиты OTP не мешают друг другу. */
export function uniquePhone(): string {
  const n = (Date.now() % 1_000_000) * 10 + (phoneSeq++ % 10);
  return `+99893${String(n).padStart(7, '0').slice(-7)}`;
}

export async function pickProduct(request: APIRequestContext, query: string): Promise<string> {
  const response = await request.get(`/api/search?locale=ru&q=${encodeURIComponent(query)}`);
  const { items } = (await response.json()) as { items: { slug: string; available: number }[] };
  // С запасом: dev-база живёт между прогонами, а тесты выкупают товар
  const item = [...items].sort((a, b) => b.available - a.available).find((i) => i.available >= 3);
  if (!item) throw new Error(`no product in stock for ${query}`);
  return item.slug;
}

export async function fillCart(page: Page, cart: Record<string, number>) {
  await page.goto('/ru');
  await page.evaluate((items) => {
    localStorage.setItem(
      'redcore-shop',
      JSON.stringify({
        state: { favorites: [], compare: { category: null, slugs: [] }, cart: items },
        version: 1,
      }),
    );
    localStorage.removeItem('redcore-checkout');
  }, cart);
}

export async function checkout(
  page: Page,
  options: { phone: string; method: 'card' | 'cod'; courier?: boolean },
) {
  await page.goto('/ru/checkout');
  await expect(page.getByTestId('checkout-form')).toBeVisible();
  await page.getByLabel('Имя и фамилия').fill('Азиз Каримов');
  await page.getByLabel('Телефон').fill(options.phone);
  if (options.courier) {
    await page.getByTestId('zone-select').selectOption('tashkent-city');
    await page.locator('#co-city').fill('Ташкент');
    await page.locator('#co-street').fill('Амира Темура');
    await page.locator('#co-house').fill('108');
  }
  await page.getByTestId(`payment-${options.method}`).check();
  await page.getByTestId('place-order').click();
  await expect(page).toHaveURL(/\/ru\/orders\/RC-\d{4}-\d{6}\?token=/);
  await expect(page.getByText('Спасибо! Заказ оформлен')).toBeVisible();
}
