import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { aiToolCalls, orders, products, user, type Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import {
  confirmDraftOrder,
  createApiKey,
  getCatalogSnapshot,
  placeOrder,
  revokeApiKey,
  type CatalogSnapshot,
  type ProductSummary,
} from '@redcore/services';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scopePresets, type ApiScope, type McpActor } from './context';
import { connectInMemory, createMcpHttpEndpoint } from './transports';

let testDb: TestDatabase;
let db: Database;
let snapshot: CatalogSnapshot;
let customerId: string;
let otherId: string;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  snapshot = await getCatalogSnapshot(db, 'ru');
  const users = await db.select({ id: user.id, role: user.role }).from(user);
  const customers = users.filter((u) => u.role !== 'admin' && u.role !== 'manager');
  customerId = customers[0]!.id;
  otherId = customers[1]?.id ?? 'someone-else';
});

afterAll(async () => {
  await testDb.close();
});

const anonymous: McpActor = { kind: 'anonymous', userId: null, apiKeyId: null, label: 'test' };

async function connect(
  scopes: readonly ApiScope[],
  actor: McpActor = anonymous,
  locale: 'ru' | 'uz' = 'ru',
) {
  return connectInMemory({
    db,
    actor,
    scopes: new Set(scopes),
    locale,
    source: 'agent',
    siteUrl: 'https://redcore.test',
    cardEnabled: true,
  });
}

type ToolResult = { content: { type: string; text?: string }[]; isError?: boolean };

async function call<T = unknown>(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  const data = JSON.parse(result.content[0]!.text!) as T;
  return { data, isError: result.isError === true };
}

const find = (predicate: (p: ProductSummary) => boolean) => {
  const product = snapshot.products.find((p) => p.available > 0 && predicate(p));
  if (!product) throw new Error('fixture product not found');
  return product;
};
const spec = (p: ProductSummary) => p.specs as Record<string, unknown>;

describe('MCP-сервер магазина: инструменты и scopes', () => {
  it('гость видит каталог, сборки и свои заказы, но не склад и не аналитику', async () => {
    const { client, close } = await connect(scopePresets.guest);
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'analyze_build',
      'check_compatibility',
      'create_draft_order',
      'create_support_ticket',
      'estimate_fps',
      'generate_builds',
      'get_delivery_options',
      'get_my_orders',
      'get_order_status',
      'get_policy',
      'get_product',
      'list_categories',
      'list_games',
      'search_products',
      'suggest_alternatives',
    ]);
    const tool = (await client.listTools()).tools.find((t) => t.name === 'search_products')!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.inputSchema.properties).toHaveProperty('query');
    await close();
  });

  it('администратор видит все 21 инструмент, ресурсы и промпты', async () => {
    const { client, close } = await connect(scopePresets.admin);
    expect((await client.listTools()).tools).toHaveLength(21);
    const resources = (await client.listResources()).resources.map((r) => r.uri);
    expect(resources).toEqual(
      expect.arrayContaining([
        'catalog://categories',
        'policy://delivery',
        'policy://warranty',
        'policy://returns',
      ]),
    );
    const delivery = await client.readResource({ uri: 'policy://delivery' });
    expect((delivery.contents[0] as { text: string }).text).toContain('Самовывоз');
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    expect(prompts).toEqual(['build_pc_for_budget', 'check_my_build']);
    const prompt = await client.getPrompt({
      name: 'build_pc_for_budget',
      arguments: { budgetUzs: '15000000', purpose: 'gaming' },
    });
    expect(JSON.stringify(prompt.messages)).toContain('generate_builds');
    await close();
  });

  it('поиск и карточка: только факты каталога, цена в сумах', async () => {
    const { client, close } = await connect(scopePresets.guest);
    const { data } = await call<{
      total: number;
      items: { slug: string; price: string; url: string; type: string }[];
    }>(client, 'search_products', { query: 'RTX 5070', inStockOnly: true, limit: 3 });
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]!.type).toBe('gpu');
    expect(data.items[0]!.price).toMatch(/сум$/);
    expect(data.items[0]!.url).toBe(`https://redcore.test/ru/p/${data.items[0]!.slug}`);
    const product = await call<{ slug: string; specs: unknown }>(client, 'get_product', {
      slug: data.items[0]!.slug,
    });
    expect(product.data.slug).toBe(data.items[0]!.slug);
    const missing = await call<{ error: string }>(client, 'get_product', {
      slug: 'no-such-product',
    });
    expect(missing).toEqual({
      isError: true,
      data: expect.objectContaining({ error: 'not_found' }),
    });
    const categories = await call<{ slug: string }[]>(client, 'list_categories');
    expect(categories.data.length).toBeGreaterThan(10);
    await close();
  });

  it('совместимость: ошибка сокета с текстом на языке клиента (RU и UZ)', async () => {
    const am5 = find((p) => p.componentType === 'cpu' && spec(p).socket === 'AM5');
    const lga1700 = find((p) => p.componentType === 'motherboard' && spec(p).socket === 'LGA1700');
    const items = [
      { slug: am5.slug, qty: 1 },
      { slug: lga1700.slug, qty: 1 },
    ];
    for (const [locale, text] of [
      ['ru', 'Сокет процессора AM5'],
      ['uz', 'AM5'],
    ] as const) {
      const { client, close } = await connect(scopePresets.guest, anonymous, locale);
      const { data } = await call<{ status: string; issues: { code: string; message: string }[] }>(
        client,
        'check_compatibility',
        { items },
      );
      expect(data.status).toBe('errors');
      const issue = data.issues.find((i) => i.code === 'cpu.socketMismatch')!;
      expect(issue.message).toContain(text);
      await close();
    }
  });

  it('FPS и подбор сборки: оценка по ключам и сборки в бюджет', async () => {
    const { client, close } = await connect(scopePresets.guest);
    const fps = await call<{ results: { game: string; fps: number; limiter: string }[] }>(
      client,
      'estimate_fps',
      {
        gpu: 'rtx-5070',
        cpu: 'ryzen-7-9800x3d',
        games: ['cyberpunk-2077', 'counter-strike-2'],
        resolution: '1440p',
        preset: 'ultra',
      },
    );
    expect(fps.data.results.map((r) => r.game)).toEqual(['cyberpunk-2077', 'counter-strike-2']);
    expect(fps.data.results[0]!.fps).toBeGreaterThan(30);
    const bad = await call<{ error: string }>(client, 'estimate_fps', { gpu: 'nope', cpu: 'nope' });
    expect(bad.isError).toBe(true);

    const builds = await call<
      Record<string, { totalUzs: number; status: string; items: { slug: string }[] } | null>
    >(client, 'generate_builds', { budgetUzs: 15_000_000, purpose: 'gaming' });
    expect(builds.data.balanced!.totalUzs).toBeLessThanOrEqual(15_000_000);
    expect(builds.data.balanced!.status).not.toBe('errors');
    // Сборку из подборщика можно сразу оценить по FPS
    const byItems = await call<{ results: unknown[] }>(client, 'estimate_fps', {
      items: builds.data.balanced!.items,
      games: ['dota-2'],
    });
    expect(byItems.isError).toBe(false);
    await close();
  });
});

describe('MCP: заказы и права', () => {
  const contact = { name: 'Тест Покупатель', phone: '+998901112233' };
  let orderNumber = '';

  it('черновик заказа: без резерва склада, подтверждение резервирует, ссылка с токеном', async () => {
    const product = find((p) => p.componentType === 'ram' && p.available >= 2);
    const before = (await db.select().from(products).where(eq(products.id, product.id)))[0]!;
    const { client, close } = await connect(scopePresets.customer, {
      kind: 'user',
      userId: customerId,
      apiKeyId: null,
      label: 'customer',
    });
    const { data } = await call<{
      number: string;
      status: string;
      confirmUrl: string;
      total: string;
    }>(client, 'create_draft_order', {
      items: [{ slug: product.slug, qty: 1 }],
      contact,
      zoneCode: 'pickup',
      paymentMethod: 'cod',
    });
    expect(data.status).toBe('draft');
    expect(data.confirmUrl).toMatch(/^https:\/\/redcore\.test\/ru\/orders\/RC-\d{4}-\d{6}\?token=/);
    const [order] = await db.select().from(orders).where(eq(orders.number, data.number));
    expect(order).toMatchObject({ status: 'draft', source: 'ai', userId: customerId });
    const mid = (await db.select().from(products).where(eq(products.id, product.id)))[0]!;
    expect(mid.reservedQty).toBe(before.reservedQty);

    await confirmDraftOrder(db, order!.id, customerId);
    const after = (await db.select().from(products).where(eq(products.id, product.id)))[0]!;
    expect(after.reservedQty).toBe(before.reservedQty + 1);
    expect((await db.select().from(orders).where(eq(orders.id, order!.id)))[0]!.status).toBe(
      'created',
    );
    orderNumber = data.number;

    const wrongZone = await call<{ error: string }>(client, 'create_draft_order', {
      items: [{ slug: product.slug, qty: 1 }],
      contact,
      zoneCode: 'mars',
      paymentMethod: 'cod',
    });
    expect(wrongZone).toMatchObject({ isError: true, data: { error: 'unknown_zone' } });
    await close();
  });

  it('статус заказа: свой — да, чужой — отказ, гость подтверждает телефоном', async () => {
    const own = await connect(scopePresets.customer, {
      kind: 'user',
      userId: customerId,
      apiKeyId: null,
      label: 'c',
    });
    expect(
      (await call<{ status: string }>(own.client, 'get_order_status', { number: orderNumber })).data
        .status,
    ).toBe('created');
    await own.close();

    const stranger = await connect(scopePresets.customer, {
      kind: 'user',
      userId: otherId,
      apiKeyId: null,
      label: 's',
    });
    const denied = await call<{ error: string }>(stranger.client, 'get_order_status', {
      number: orderNumber,
    });
    expect(denied).toMatchObject({ isError: true, data: { error: 'not_found' } });
    const unknown = await call<{ error: string }>(stranger.client, 'get_order_status', {
      number: 'RC-2099-999999',
    });
    // Чужой и несуществующий заказ неотличимы
    expect(unknown.data).toMatchObject({ error: 'not_found' });
    await stranger.close();

    const guest = await connect(scopePresets.guest);
    expect((await call(guest.client, 'get_order_status', { number: orderNumber })).isError).toBe(
      true,
    );
    const withPhone = await call<{ number: string }>(guest.client, 'get_order_status', {
      number: orderNumber,
      phone: '90 111 22 33',
    });
    expect(withPhone.data.number).toBe(orderNumber);
    await guest.close();
  });

  it('персонал: смена статуса по машине состояний, склад, аналитика', async () => {
    const { client, close } = await connect(scopePresets.manager, {
      kind: 'staff',
      userId: null,
      apiKeyId: null,
      label: 'mgr',
    });
    const moved = await call<{ from: string; to: string }>(client, 'update_order_status', {
      number: orderNumber,
      to: 'assembling',
    });
    expect(moved.data).toEqual({ number: orderNumber, from: 'created', to: 'assembling' });
    const illegal = await call<{ error: string }>(client, 'update_order_status', {
      number: orderNumber,
      to: 'draft',
    });
    expect(illegal).toMatchObject({ isError: true, data: { error: 'invalid_transition' } });

    const product = find((p) => p.componentType === 'case');
    const stock = await call<{ stock: number }[]>(client, 'get_stock', {
      products: [product.slug, 'nope'],
    });
    expect(stock.data[1]).toEqual({ product: 'nope', found: false });
    const adjusted = await call<{ stock: number }>(client, 'adjust_stock', {
      product: product.slug,
      delta: 5,
      note: 'поставка',
    });
    expect(adjusted.data.stock).toBe(product.stockQty + 5);
    const low = await call<unknown[]>(client, 'low_stock_report', { threshold: 100 });
    expect(low.data.length).toBeGreaterThan(0);
    const report = await call<{ orders: number; revenue: string }>(client, 'sales_report', {
      period: 'd30',
    });
    expect(report.data.orders).toBeGreaterThan(0);
    await close();
  });

  it('черновик можно отменить без движения склада (резерва не было)', async () => {
    const product = find((p) => p.componentType === 'storage');
    const placed = await placeOrder(
      db,
      snapshot,
      {
        checkoutAttemptId: randomUUID(),
        items: [{ slug: product.slug, qty: 1 }],
        contact,
        zoneCode: 'pickup',
        paymentMethod: 'cod',
      },
      { locale: 'ru', cardEnabled: true, draft: true, source: 'mcp' },
    );
    const before = (await db.select().from(products).where(eq(products.id, product.id)))[0]!;
    const { client, close } = await connect(scopePresets.manager, {
      kind: 'staff',
      userId: null,
      apiKeyId: null,
      label: 'mgr',
    });
    await call(client, 'update_order_status', { number: placed.number, to: 'cancelled' });
    const after = (await db.select().from(products).where(eq(products.id, product.id)))[0]!;
    expect(after.reservedQty).toBe(before.reservedQty);
    await close();
  });

  it('каждый вызов в журнале, телефоны и почта замаскированы', async () => {
    const rows = await db
      .select()
      .from(aiToolCalls)
      .where(eq(aiToolCalls.tool, 'create_draft_order'))
      .orderBy(desc(aiToolCalls.createdAt));
    expect(rows.length).toBeGreaterThan(0);
    const logged = JSON.stringify(rows[0]!.args);
    expect(logged).not.toContain('901112233');
    expect(logged).toContain('+998 ** *** ** 33');
    expect(rows.every((r) => r.source === 'agent' && r.transport === 'in-memory')).toBe(true);
  });
});

describe('MCP по HTTP с API-ключами', () => {
  const endpoint = () =>
    createMcpHttpEndpoint({
      getDb: async () => db,
      siteUrl: 'https://redcore.test',
      cardEnabled: true,
    });

  async function httpClient(key: string) {
    const handle = endpoint();
    const transport = new StreamableHTTPClientTransport(new URL('https://redcore.test/api/mcp'), {
      fetch: (url, init) => {
        const headers = new Headers(init?.headers);
        headers.set('authorization', `Bearer ${key}`);
        return handle(new Request(url, { ...init, headers }));
      },
    });
    const client = new Client(
      { name: 'http-test', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    await client.connect(transport);
    return client;
  }

  it('без ключа или с отозванным — 401', async () => {
    const handle = endpoint();
    const noKey = await handle(
      new Request('https://redcore.test/api/mcp', { method: 'POST', body: '{}' }),
    );
    expect(noKey.status).toBe(401);
    expect(noKey.headers.get('www-authenticate')).toContain('Bearer');
    const created = await createApiKey(db, { name: 'Revoked', scopes: ['catalog:read'] }, null);
    await revokeApiKey(db, created.id);
    const revoked = await handle(
      new Request('https://redcore.test/api/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${created.key}` },
        body: '{}',
      }),
    );
    expect(revoked.status).toBe(401);
  });

  it('ключ без orders:write не видит и не может вызвать смену статуса', async () => {
    const reader = await createApiKey(
      db,
      { name: 'Cursor', scopes: ['catalog:read', 'builds:read'] },
      null,
    );
    const client = await httpClient(reader.key);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain('search_products');
    expect(names).not.toContain('update_order_status');
    // Инструмента нет на сервере этого ключа — SDK отклоняет вызов ошибкой протокола
    await expect(
      client.callTool({
        name: 'update_order_status',
        arguments: { number: 'RC-2026-000001', to: 'cancelled' },
      }),
    ).rejects.toThrow(/not found/);
    const found = await call<{ items: unknown[] }>(client, 'search_products', {
      query: 'ryzen',
      limit: 2,
    });
    expect(found.data.items).toHaveLength(2);
    await client.close();

    const [log] = await db.select().from(aiToolCalls).where(eq(aiToolCalls.apiKeyId, reader.id));
    expect(log).toMatchObject({
      source: 'mcp_external',
      transport: 'http',
      tool: 'search_products',
      ok: true,
    });
  });
});
