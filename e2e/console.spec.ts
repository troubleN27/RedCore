import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { checkout, fillCart, pickProduct, uniquePhone } from './helpers/shop';
import { BASE, PASSWORD, staffLogin, submitPassword } from './helpers/staff';
import { openViewer } from './helpers/viewer';

const fixtures = path.join(process.cwd(), 'e2e', 'fixtures');

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ isMobile }) => {
  // Сценарии консоли меняют общие данные (заказы, цены, ключи) — гоняем их одним проектом
  test.skip(isMobile, 'консоль проверяется на десктопе');
});

test('консоль скрыта: /admin, прямой путь и HTTP-вход персонала — 404', async ({
  page,
  request,
}) => {
  for (const url of ['/admin', '/ru/admin', '/ru/console', '/uz/console/login']) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  expect(
    (
      await request.post('/api/auth/sign-in/username', {
        data: { username: 'admin', password: PASSWORD },
      })
    ).status(),
  ).toBe(404);
  const response = await page.goto(BASE);
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page).toHaveURL(new RegExp(`${BASE}/login`));
  await expect(page.getByTestId('staff-login')).toBeVisible();
});

test('вход в консоль по логину и паролю; покупатель и неверный пароль не пускаются', async ({
  page,
}) => {
  await staffLogin(page, 'admin');
  await page.getByTestId('staff-logout').click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/login`));
  // Без входа раздел недоступен
  await page.goto(`${BASE}/orders`);
  await expect(page).toHaveURL(new RegExp(`${BASE}/login`));

  await submitPassword(page, 'manager', 'wrong-password');
  await expect(page.getByTestId('staff-error')).toContainText('Неверный логин или пароль');
  // Аккаунт покупателя с верным паролем — тоже отказ: консоль только для персонала
  await submitPassword(page, '998901234567', 'RedCore-Demo-2026');
  await expect(page.getByTestId('staff-error')).toContainText('Неверный логин или пароль');
});

test('после 5 неудачных попыток вход блокируется', async ({ page }) => {
  const login = `ghost${Date.now()}`;
  for (let i = 0; i < 4; i++) {
    await submitPassword(page, login, 'wrong-password');
    await expect(page.getByTestId('staff-error')).toContainText('Неверный логин или пароль');
  }
  await submitPassword(page, login, 'wrong-password');
  await expect(page.getByTestId('staff-error')).toContainText('Вход заблокирован до');
  await submitPassword(page, login, PASSWORD);
  await expect(page.getByTestId('staff-error')).toContainText('Вход заблокирован до');
});

test('менеджер не видит пользователей и настройки', async ({ page }) => {
  await staffLogin(page, 'manager');
  const nav = page.getByTestId('console-nav');
  await expect(nav.locator('[data-section="orders"]')).toBeVisible();
  for (const section of ['users', 'settings', 'audit']) {
    await expect(nav.locator(`[data-section="${section}"]`)).toHaveCount(0);
  }
  for (const section of ['users', 'settings', 'audit']) {
    const response = await page.goto(`${BASE}/${section}`);
    expect(response?.status(), section).toBe(404);
  }
});

test('возврат из консоли: Stripe/мок → вебхук → заказ «возвращён», KPI на дашборде', async ({
  page,
  browser,
  request,
}) => {
  // Покупатель оплачивает заказ картой (мок-шлюз)
  const search = await request.get('/api/search?locale=ru&q=NVMe');
  const { items } = (await search.json()) as { items: { slug: string; available: number }[] };
  const slug = [...items].sort((a, b) => b.available - a.available)[0]!.slug;
  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto('/ru');
  await shopper.evaluate((s) => {
    localStorage.setItem(
      'redcore-shop',
      JSON.stringify({
        state: { favorites: [], compare: { category: null, slugs: [] }, cart: { [s]: 1 } },
        version: 1,
      }),
    );
  }, slug);
  await shopper.goto('/ru/checkout');
  await shopper.getByLabel('Имя и фамилия').fill('Покупатель Консоли');
  await shopper.getByLabel('Телефон').fill('+998 97 111 22 33');
  await shopper.getByTestId('payment-card').check();
  await shopper.getByTestId('place-order').click();
  await expect(shopper).toHaveURL(/\/ru\/orders\/RC-/);
  const number = (await shopper.getByRole('heading', { level: 1 }).textContent())!.replace(
    'Заказ ',
    '',
  );
  await shopper.getByTestId('mock-pay').click();
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'paid', {
    timeout: 15_000,
  });

  await staffLogin(page, 'admin');
  await expect(page.getByTestId('kpi-revenue')).not.toHaveText(/^0\s/);

  await page.goto(`${BASE}/orders?q=${number}`);
  await page.getByRole('link', { name: number }).click();
  await expect(page.getByTestId('console-order')).toHaveAttribute('data-status', 'paid');
  await page.getByTestId('refund-submit').click();
  await expect(page.getByTestId('console-order')).toHaveAttribute('data-status', 'refunded', {
    timeout: 15_000,
  });

  // Покупатель видит возврат, в журнале платежей — событие charge.refunded
  await shopper.reload();
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'refunded');
  await page.goto(`${BASE}/payments`);
  await expect(page.getByTestId('stripe-events')).toContainText('charge.refunded');
  await page.goto(`${BASE}/audit`);
  await expect(page.getByTestId('audit-log')).toContainText('order.refund');
});

test('загрузка своей GLB, проверка файла, показ на карточке и удаление', async ({
  page,
  request,
}) => {
  const search = await request.get('/api/search?locale=ru&q=webcam');
  const { items } = (await search.json()) as { items: { slug: string; name: string }[] };
  const product = items[0]!;

  await staffLogin(page, 'admin');
  await page.goto(`${BASE}/products?q=${encodeURIComponent(product.name)}`);
  await page.getByTestId('console-products').getByRole('link').first().click();
  const upload = page.getByTestId('model-upload');
  await expect(upload).toBeVisible();

  await upload.getByTestId('model-file').setInputFiles(path.join(fixtures, 'not-a-model.glb'));
  await expect(upload.getByTestId('model-error')).toHaveText('Это не файл GLB.');

  await upload.getByTestId('model-file').setInputFiles(path.join(fixtures, 'box.glb'));
  await expect(upload.getByTestId('model-current')).toContainText('12 треугольников', {
    timeout: 15_000,
  });

  // Витрина показывает загруженную модель вместо процедурной
  const { viewer } = await openViewer(page, product.slug);
  await expect(viewer).toHaveAttribute('data-source', 'glb');

  await page.goBack();
  await page.getByRole('button', { name: 'Убрать свою модель' }).click();
  await expect(upload.getByTestId('model-current')).toContainText('Своей модели нет');
});

test('игры калькулятора FPS: менеджер добавляет игру — она сразу на /fps; импорт CSV', async ({
  page,
}) => {
  await staffLogin(page, 'manager');
  await page.goto(`${BASE}/games`);
  await expect(page.getByTestId('console-games')).toContainText('Cyberpunk 2077');

  // Импорт: одна строка применяется, ошибочная перечисляется с номером
  await page.getByTestId('benchmark-file').setInputFiles(path.join(fixtures, 'benchmarks.csv'));
  await page.getByTestId('benchmark-import').click();
  const report = page.getByTestId('benchmark-report');
  await expect(report).toContainText('Обновлено строк: 1');
  await expect(report).toContainText('строка 4: unknown game: no-such-game');

  const slug = `e2e-game-${Date.now()}`;
  await page.getByTestId('game-new').click();
  const form = page.getByTestId('game-form');
  await form.getByTestId('game-name').fill('E2E Racing');
  await form.getByTestId('game-slug').fill(slug);
  for (const [i, res] of ['1080p', '1440p', '2160p'].entries()) {
    for (const [j, preset] of ['low', 'medium', 'high', 'ultra'].entries()) {
      await form.getByTestId(`game-gpu-${res}-${preset}`).fill(String(300 - i * 80 - j * 30));
      await form.getByTestId(`game-vram-${res}-${preset}`).fill(String(4 + i + j * 0.5));
    }
  }
  for (const [j, preset] of ['low', 'medium', 'high', 'ultra'].entries()) {
    await form.getByTestId(`game-cpu-${preset}`).fill(String(260 - j * 20));
  }
  await form.getByTestId('game-save').click();
  await expect(page.getByText('Игра сохранена')).toBeVisible();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);

  await page.goto('/ru/fps');
  await expect(page.locator(`[data-testid="fps-row"][data-game="${slug}"]`)).toBeVisible();
});

test('MCP: админ создаёт ключ, внешний клиент работает по scopes, отзыв ключа — 401', async ({
  page,
  baseURL,
}) => {
  await staffLogin(page, 'admin');
  await page.goto(`${BASE}/mcp`);
  const form = page.getByTestId('api-key-form');
  await form.getByTestId('api-key-name').fill(`E2E Cursor ${Date.now()}`);
  await form.getByTestId('scope-orders:write:own').click();
  await form.getByTestId('api-key-create').click();
  const key = (await page.getByTestId('api-key-value').textContent())!.trim();
  expect(key).toMatch(/^rc_[A-Za-z0-9]{32}$/);

  const transport = new StreamableHTTPClientTransport(new URL('/api/mcp', baseURL), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  });
  const client = new Client(
    { name: 'e2e', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((t) => t.name);
  expect(names).toContain('search_products');
  expect(names).toContain('estimate_fps');
  expect(names).not.toContain('update_order_status');
  const result = (await client.callTool({
    name: 'search_products',
    arguments: { query: 'RTX', limit: 2 },
  })) as { content: { text: string }[] };
  const found = JSON.parse(result.content[0]!.text) as { items: { slug: string }[] };
  expect(found.items).toHaveLength(2);

  // Черновик заказа от внешнего клиента: покупатель открывает ссылку и подтверждает
  const draft = (await client.callTool({
    name: 'create_draft_order',
    arguments: {
      items: [{ slug: found.items[0]!.slug, qty: 1 }],
      contact: { name: 'MCP Покупатель', phone: '+998901234567' },
      zoneCode: 'pickup',
      paymentMethod: 'cod',
    },
  })) as { content: { text: string }[] };
  const { confirmUrl } = JSON.parse(draft.content[0]!.text) as { confirmUrl: string };
  await client.close();
  const shopper = await page.context().newPage();
  await shopper.goto(new URL(confirmUrl).pathname + new URL(confirmUrl).search);
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'draft');
  await shopper.getByTestId('confirm-draft').click();
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'created');
  await shopper.close();

  await page.reload();
  await expect(page.getByTestId('tool-calls')).toContainText('search_products');
  const row = page.getByTestId('api-keys').locator('tr', { hasText: key.slice(0, 11) });
  await row.getByTestId('api-key-revoke').click();
  await expect(row).toContainText('Отозван');
  const revoked = await page.request.post('/api/mcp', {
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  });
  expect(revoked.status()).toBe(401);
});

test('AI в консоли: помощник без ключа отвечает сводкой, логи запусков и диалог', async ({
  page,
}) => {
  await staffLogin(page, 'manager');
  await page.goto(`${BASE}/ai`);
  await expect(page.getByTestId('ai-key-missing')).toBeVisible();
  const panel = page.getByTestId('chat-panel');
  await panel.getByTestId('chat-input').fill('Продажи за неделю');
  await panel.getByTestId('chat-send').click();
  await expect(panel).toHaveAttribute('data-pending', 'false', { timeout: 30_000 });
  const reply = panel.getByTestId('chat-reply').last();
  await expect(reply).toHaveAttribute('data-agent', 'admin');
  await expect(reply.getByTestId('chat-chart')).toBeVisible();
  // Менеджер не видит настроек AI (только администратор)
  await expect(page.getByTestId('ai-settings')).toHaveCount(0);

  await page.reload();
  const runs = page.getByTestId('ai-runs');
  await expect(runs).toContainText('Помощник администратора');
  await runs.getByRole('link').first().click();
  await expect(page.getByTestId('ai-dialog')).toContainText('Продажи за неделю');
});

test('Telegram: подписка на заказ по ссылке через вебхук бота, вебхук проверяет секрет', async ({
  request,
  browser,
}) => {
  const shopper = await browser.newPage();
  await fillCart(shopper, { [await pickProduct(request, 'NVMe')]: 1 });
  await checkout(shopper, { phone: uniquePhone(), method: 'cod' });
  const number = /orders\/(RC-\d{4}-\d{6})/.exec(shopper.url())![1]!;

  // Кнопка открывает t.me/<бот>?start=<токен> — перехватываем адрес вместо перехода
  await shopper.evaluate(() => {
    window.open = (url) => {
      (window as unknown as { __tg: string }).__tg = String(url);
      return null;
    };
  });
  await shopper.getByTestId('telegram-link').click();
  await expect
    .poll(() => shopper.evaluate(() => (window as unknown as { __tg?: string }).__tg))
    .toMatch(/^https:\/\/t\.me\/\w+\?start=[\w-]+$/);
  const startToken = new URL(
    await shopper.evaluate(() => (window as unknown as { __tg: string }).__tg),
  ).searchParams.get('start')!;

  // Пользователь нажал Start в Telegram — апдейт приходит в вебхук бота
  const chatId = 700_000_000 + Math.floor(Math.random() * 1_000_000);
  const update = await request.post('/api/webhooks/telegram', {
    headers: {
      'x-telegram-bot-api-secret-token': process.env.CI
        ? 'e2e-telegram-secret'
        : 'dev-telegram-secret',
    },
    data: {
      update_id: chatId,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'E2E' },
        from: { id: chatId, is_bot: false, first_name: 'E2E', language_code: 'ru' },
        text: `/start ${startToken}`,
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    },
  });
  expect(update.status()).toBe(200);
  const wrongSecret = await request.post('/api/webhooks/telegram', {
    headers: { 'x-telegram-bot-api-secret-token': 'nope' },
    data: { update_id: 1 },
  });
  expect(wrongSecret.status()).toBe(401);

  // Тексты сообщений и доставку статусов проверяют юнит-тесты бота (packages/services)
  await shopper.close();
});

test('правка цены в консоли сразу видна на витрине (сброс пререндера карточки)', async ({
  page,
  request,
}) => {
  const search = await request.get('/api/search?locale=ru&q=mousepad');
  const { items } = (await search.json()) as { items: { slug: string; name: string }[] };
  const product = items[0]!;
  // Открываем карточку на витрине заранее — её пререндер попадает в кэш
  await page.goto(`/ru/p/${product.slug}`);

  await staffLogin(page, 'manager');
  await page.goto(`${BASE}/products?q=${encodeURIComponent(product.name)}`);
  await page.getByTestId('console-products').getByRole('link').first().click();
  const price = page.locator('#pf-priceUzs');
  const next = Number(await price.inputValue()) + 10_000;
  await price.fill(String(next));
  await page.getByTestId('product-save').click();
  await expect(page.getByText('Товар сохранён')).toBeVisible();

  // 430000 → «430 000 сум»: между группами разрядов — неразрывный пробел
  const digits = String(next).replace(/\B(?=(\d{3})+(?!\d))/g, String.raw`\s`);
  await page.goto(`/ru/p/${product.slug}`);
  await expect(page.getByRole('main')).toContainText(new RegExp(String.raw`${digits}\sсум`));
});

test('сквозной сценарий: каталог → конфигуратор → оплата картой → возврат из консоли', async ({
  page,
  browser,
}) => {
  // Восемь шагов конфигуратора с 3D-сценой на программном WebGL — на раннере CI это минуты
  test.setTimeout(240_000);
  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto('/ru');
  await shopper.evaluate(() => {
    localStorage.removeItem('redcore-configurator');
    localStorage.removeItem('redcore-shop');
  });

  // Каталог: категория видеокарт → карточка товара
  await shopper
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Каталог' })
    .click();
  await expect(shopper).toHaveURL(/\/ru\/catalog$/);
  await shopper.goto('/ru/catalog/gpu');
  await shopper.getByTestId('product-card').first().getByRole('link').first().click();
  await expect(shopper).toHaveURL(/\/ru\/p\//);

  // Конфигуратор: совместимая сборка из первых кандидатов каждого шага → в корзину
  await shopper
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Конфигуратор' })
    .click();
  await expect(shopper.getByTestId('configurator')).toHaveAttribute('data-hydrated', 'true', {
    timeout: 30_000,
  });
  const lines = shopper.getByTestId('summary-lines').locator('li');
  const slots = ['case', 'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu'];
  for (const [i, slot] of slots.entries()) {
    await shopper.getByTestId(`step-${slot}`).click();
    await shopper.getByTestId('candidate-select').first().click();
    await expect(lines).toHaveCount(i + 1);
  }
  await expect(
    shopper.getByTestId('build-summary').getByTestId('build-status'),
  ).not.toHaveAttribute('data-status', 'errors');
  await shopper.getByTestId('build-to-cart').click();
  await shopper.goto('/ru/cart');
  await expect(shopper.getByTestId('cart-line')).toHaveCount(8);

  // Оформление и оплата картой (мок-шлюз → подписанный вебхук → «оплачен»)
  await shopper.goto('/ru/checkout');
  await shopper.getByLabel('Имя и фамилия').fill('Сквозной Сценарий');
  await shopper.getByLabel('Телефон').fill(`+99890${String(Date.now()).slice(-7)}`);
  await shopper.getByTestId('payment-card').check();
  await shopper.getByTestId('place-order').click();
  await expect(shopper).toHaveURL(/\/ru\/orders\/RC-/);
  const number = /orders\/(RC-\d{4}-\d{6})/.exec(shopper.url())![1]!;
  await shopper.getByTestId('mock-card').fill('4242 4242 4242 4242');
  await shopper.getByTestId('mock-pay').click();
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'paid', {
    timeout: 15_000,
  });

  // Возврат из консоли → вебхук charge.refunded → заказ «возвращён» у покупателя
  await staffLogin(page, 'admin');
  await page.goto(`${BASE}/orders?q=${number}`);
  await page.getByRole('link', { name: number }).click();
  await page.getByTestId('refund-submit').click();
  await expect(page.getByTestId('console-order')).toHaveAttribute('data-status', 'refunded', {
    timeout: 15_000,
  });
  await shopper.reload();
  await expect(shopper.getByTestId('order-page')).toHaveAttribute('data-status', 'refunded');
  await shopper.close();
});
