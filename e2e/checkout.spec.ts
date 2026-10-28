import { expect, test, type Page } from '@playwright/test';
import { checkout, fillCart, pickProduct, uniquePhone } from './helpers/shop';

// Покупка без Stripe-ключей идёт через мок-шлюз: он шлёт подписанные события в тот же
// вебхук, что и Stripe, поэтому «оплачен» выставляет только обработчик вебхука.

async function payWithCard(page: Page, card: string) {
  await expect(page.getByTestId('mock-payment')).toBeVisible();
  await page.getByTestId('mock-card').fill(card);
  await page.getByTestId('mock-pay').click();
}

const orderPage = (page: Page) => page.getByTestId('order-page');

test.describe('корзина и оформление', () => {
  test('корзина: промокод и итог', async ({ page, request }) => {
    const cpu = await pickProduct(request, 'Ryzen 7');
    const board = await pickProduct(request, 'B850');
    await fillCart(page, { [cpu]: 1, [board]: 1 });
    await page.goto('/ru/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await page.getByLabel('Промокод').fill('nope');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-error')).toHaveText(/Такого промокода нет/);
    await page.getByText('Убрать промокод').click();
    await page.getByLabel('Промокод').fill('redcore10');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-applied')).toContainText('REDCORE10');
    await expect(page.getByTestId('order-totals')).toContainText('Скидка по промокоду');
  });

  test('гость: самовывоз и оплата при получении', async ({ page, request }) => {
    await fillCart(page, { [await pickProduct(request, 'NVMe')]: 1 });
    await checkout(page, { phone: uniquePhone(), method: 'cod' });
    await expect(orderPage(page)).toHaveAttribute('data-status', 'created');
    await expect(page.getByTestId('payment-status')).toHaveText(/При получении · Не оплачен/i);
    await expect(page.getByTestId('payment-panel')).toHaveCount(0);
    // Корзина очищена после оформления
    await page.goto('/ru/cart');
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });
});

test.describe('оплата картой (мок-шлюз → вебхук)', () => {
  test('4242: заказ оплачен через вебхук', async ({ page, request }) => {
    await fillCart(page, { [await pickProduct(request, 'NVMe')]: 1 });
    await checkout(page, { phone: uniquePhone(), method: 'card', courier: true });
    await expect(orderPage(page)).toHaveAttribute('data-status', /created|pending_payment/);
    await payWithCard(page, '4242 4242 4242 4242');
    await expect(orderPage(page)).toHaveAttribute('data-status', 'paid', { timeout: 15_000 });
    await expect(page.getByTestId('order-timeline')).toContainText('платёжная система');
  });

  test('3-D Secure: подтверждение банка', async ({ page, request }) => {
    await fillCart(page, { [await pickProduct(request, 'SSD')]: 1 });
    await checkout(page, { phone: uniquePhone(), method: 'card' });
    await payWithCard(page, '4000 0025 0000 3155');
    await expect(page.getByTestId('threeds')).toBeVisible();
    await page.getByTestId('threeds-confirm').click();
    await expect(orderPage(page)).toHaveAttribute('data-status', 'paid', { timeout: 15_000 });
  });

  test('9995: отказ, заказ ждёт оплаты, повтор другой картой', async ({ page, request }) => {
    await fillCart(page, { [await pickProduct(request, 'SSD')]: 1 });
    await checkout(page, { phone: uniquePhone(), method: 'card' });
    await payWithCard(page, '4000 0000 0000 9995');
    await expect(page.getByTestId('payment-declined')).toContainText('недостаточно средств', {
      timeout: 15_000,
    });
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending_payment');
    await payWithCard(page, '4242 4242 4242 4242');
    await expect(orderPage(page)).toHaveAttribute('data-status', 'paid', { timeout: 15_000 });
  });

  test('истечение срока оплаты отменяет заказ', async ({ page, request }) => {
    await fillCart(page, { [await pickProduct(request, 'HDD')]: 1 });
    await checkout(page, { phone: uniquePhone(), method: 'card' });
    await expect(page.getByTestId('mock-payment')).toBeVisible();
    await page.getByTestId('mock-expire').click();
    await expect(orderPage(page)).toHaveAttribute('data-status', 'cancelled', { timeout: 15_000 });
    await expect(page.getByText('Причина: время на оплату истекло')).toBeVisible();
  });
});

test.describe('аккаунт', () => {
  test('регистрация по телефону и паролю, заказ в кабинете, повторный вход', async ({
    page,
    request,
  }) => {
    const phone = uniquePhone();
    const password = 'Test-Password-1';
    const product = await pickProduct(request, 'NVMe');
    await fillCart(page, { [product]: 2 });

    await page.goto('/ru/login?next=/account/orders');
    await page.getByTestId('tab-register').click();
    await page.getByLabel('Номер телефона').fill(phone);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль').fill('другой-пароль');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('Пароли не совпадают');

    await page.getByLabel('Повторите пароль').fill(password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/ru\/account\/orders$/);

    // Корзина гостя сохранилась в аккаунте, заказ вошедшего покупателя — в кабинете
    await page.goto('/ru/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-qty')).toHaveText('2');
    await checkout(page, { phone, method: 'cod' });
    const number = (await page.getByRole('heading', { level: 1 }).textContent())!.replace(
      'Заказ ',
      '',
    );
    await page.goto('/ru/account/orders');
    await expect(page.getByTestId('account-orders')).toContainText(number, { timeout: 10_000 });

    await page.goto('/ru/account');
    await page.getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/ru$/);

    // Повторная регистрация того же номера — подсказка войти
    await page.goto('/ru/login');
    await page.getByTestId('tab-register').click();
    await page.getByLabel('Номер телефона').fill(phone);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль').fill(password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('уже зарегистрирован');

    // Вход — номер и пароль
    await page.getByTestId('tab-sign-in').click();
    await page.getByLabel('Номер телефона').fill(phone);
    await page.getByLabel('Пароль', { exact: true }).fill('неверный-пароль');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText(
      'Неверный номер телефона или пароль',
    );
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/ru\/account$/);
  });

  test('кабинет без входа ведёт на страницу входа', async ({ page }) => {
    await page.goto('/ru/account/orders');
    await expect(page).toHaveURL(/\/ru\/login\?next=%2Faccount|\/ru\/login\?next=\/account/);
  });
});

test('страницы покупки без горизонтального скролла на телефоне', async ({
  page,
  isMobile,
  request,
}) => {
  test.skip(!isMobile, 'проверка ширины — для мобильного проекта');
  await fillCart(page, { [await pickProduct(request, 'NVMe')]: 1 });
  for (const path of ['/ru/cart', '/uz/checkout', '/ru/login', '/ru/configurator']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
