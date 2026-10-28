# MCP-сервер магазина

Пакет `packages/mcp` реализует Model Context Protocol на SDK v2: `@modelcontextprotocol/server`
и `@modelcontextprotocol/client` 2.4, спецификация 2026-07-28.

Одни и те же инструменты обслуживают трёх клиентов:

- **агентов магазина** (этап 10) — в памяти процесса;
- **внешние приложения** — по HTTP с API-ключом;
- **Claude Desktop и Cursor** — по stdio.

Бизнес-логика не дублируется: инструменты вызывают те же сервисы, что сайт и консоль.

## Инструменты и права

`createShopMcpServer(ctx)` (21 инструмент, из них 6 — для агентов этапа 10: `get_my_orders`,
`get_policy`, `create_support_ticket`, `analyze_build`, `suggest_alternatives`,
`purchase_recommendations`, scope `support:write`) регистрирует только те инструменты, на которые у контекста есть
scope. Клиент без прав не видит инструмент в `tools/list`, а вызов несуществующего для него
инструмента отклоняется протоколом.

| Инструмент             | Scope                                 | Что делает                                                                  |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `search_products`      | `catalog:read`                        | Поиск по каталогу (RU/UZ/EN, синонимы), фильтры категории, наличия, цены    |
| `get_product`          | `catalog:read`                        | Карточка: характеристики, цена, остаток, описание, ссылка                   |
| `list_categories`      | `catalog:read`                        | Категории с количеством товаров и ценой «от»                                |
| `check_compatibility`  | `builds:read`                         | Совместимость сборки, тексты проблем на языке клиента, мощность БП          |
| `estimate_fps`         | `builds:read`                         | Оценка FPS для сборки или пары GPU+CPU (см. [FPS_METHOD.md](FPS_METHOD.md)) |
| `list_games`           | `builds:read`                         | Игры калькулятора FPS                                                       |
| `generate_builds`      | `builds:read`                         | Три сборки под бюджет из наличия: −20% / бюджет / +25%                      |
| `get_order_status`     | `orders:read:own` или `orders:read`   | Статус, оплата, состав и история заказа                                     |
| `get_delivery_options` | `catalog:read` или `orders:write*`    | Зоны доставки: цена, сроки, оплата при получении                            |
| `create_draft_order`   | `orders:write:own` или `orders:write` | **Черновик** заказа и ссылка на подтверждение                               |
| `update_order_status`  | `orders:write`                        | Смена статуса по машине состояний (персонал)                                |
| `get_stock`            | `stock:read`                          | Остаток, резерв и доступное количество                                      |
| `low_stock_report`     | `stock:read`                          | Товары с остатком ниже порога                                               |
| `adjust_stock`         | `stock:write`                         | Приход или списание с комментарием, не ниже резерва                         |
| `sales_report`         | `analytics:read`                      | KPI за 7, 30 или 90 дней, топ товаров, воронка конфигуратора                |

**Ресурсы:**

- `catalog://categories`;
- `policy://delivery` — с актуальными зонами из базы;
- `policy://payment`, `policy://warranty`, `policy://returns`.

Тексты правил лежат в словарях `policies` (RU/UZ).

**Промпты:**

- `build_pc_for_budget` — подбор под бюджет;
- `check_my_build` — проверка своей сборки.

## Гарантии и безопасность

**Права — в замыкании.** Actor (кто вызывает) и scopes фиксируются при создании сервера.
Аргументы модели или клиента расширить их не могут.

**Свои заказы.** Со scope `orders:read:own` виден только заказ:

- своего пользователя (владелец ключа или вошедший покупатель);
- гостевой, если клиент назвал телефон из заказа.

Чужой и несуществующий номер дают одинаковый ответ `not_found`, поэтому перебор номеров ничего
не раскрывает.

**Черновики заказов.** `create_draft_order` не резервирует товар и ничего не списывает.

1. Заказ создаётся в статусе `draft` с пометкой источника: `mcp` или `ai`.
2. Клиент получает `confirmUrl` — страницу заказа с секретным токеном.
3. Покупатель проверяет состав и нажимает «Подтвердить заказ».
4. Только в этот момент товар резервируется, и заказ становится «Принят». Дальше — обычная
   оплата картой или при получении.
5. Отмена черновика не трогает склад.

**Цены и наличие** всегда берутся из базы. Ответ содержит id и slug, чтобы интерфейс
рендерил карточки по базе, а не по тексту модели.

**Журнал.** Каждый вызов пишется в `ai_tool_calls`:

- источник (`agent` или `mcp_external`), транспорт, ключ или пользователь;
- аргументы, превью ответа, успех или код ошибки, длительность.

Телефоны и почта маскируются: `+998 ** *** ** 67`, `a***@mail.uz`. Журнал виден в консоли →
«MCP».

**Ключи** `rc_…` (32 символа) хранятся только как SHA-256.

- В консоли видны префикс, scopes, владелец, время последнего использования.
- Значение ключа показывается один раз при создании.
- Отзыв действует сразу.

## Транспорты

### In-memory (агенты, тесты)

```ts
import { connectInMemory, scopePresets } from '@redcore/mcp';

const { client, close } = await connectInMemory({
  db,
  actor: { kind: 'user', userId, apiKeyId: null, label: email },
  scopes: new Set(scopePresets.customer),
  locale: 'ru',
  source: 'agent',
  siteUrl,
  cardEnabled: true,
});
const tools = await client.listTools(); // → декларации функций для Gemini (этап 10)
await close();
```

### Streamable HTTP — `/api/mcp`

1. Консоль → «MCP» → «Новый ключ»: выбрать scopes и, при необходимости, пользователя для
   прав «:own».
2. Подключиться с заголовком `Authorization: Bearer rc_…`.

Подробности обработки:

- Ключ проверяется до SDK.
- Сервер для запроса собирается ровно с инструментами ключа.
- Клиенты спецификации 2025 года обслуживаются stateless-режимом того же обработчика.
- Язык ответов: `?locale=uz` или заголовок `Accept-Language`.

Cursor, `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "redcore": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer rc_ваш_ключ" }
    }
  }
}
```

### stdio — Claude Desktop, Cursor, Inspector

```bash
pnpm mcp:stdio      # сервер на stdin/stdout, логи — в stderr
pnpm mcp:inspect    # MCP Inspector (UI) поверх stdio
```

Кто работает через stdio, задаёт `MCP_STDIO_ACTOR`:

| Значение            | Права                                               |
| ------------------- | --------------------------------------------------- |
| `guest` (по умолч.) | каталог, сборки, свои заказы по телефону, черновики |
| `customer:<номер>`  | то же от имени покупателя (номер телефона — логин)  |
| `manager`           | плюс все заказы, склад, аналитика                   |
| `admin`             | все scopes                                          |

Язык задаёт `MCP_LOCALE=ru|uz`. Без `DATABASE_URL` сервер поднимает встроенную PGlite с seed.

Claude Desktop, `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "redcore": {
      "command": "pnpm",
      "args": ["--dir", "D:/PROWEB/troubleN/RedCore", "--silent", "mcp:stdio"],
      "env": { "MCP_STDIO_ACTOR": "guest", "MCP_LOCALE": "ru" }
    }
  }
}
```

Inspector в CLI-режиме (проверено):

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli -e MCP_STDIO_ACTOR=admin pnpm --silent --filter @redcore/mcp stdio --method tools/list
```

Под `admin` выводит 15 инструментов, под `guest` — 10.

## Тесты

**`packages/mcp/src/mcp.test.ts`** (PGlite с seed, `InMemoryTransport`):

- наборы инструментов по ролям;
- поиск и карточка;
- совместимость на RU и UZ;
- FPS и подбор;
- черновик без резерва и подтверждение с резервом;
- свой, чужой и гостевой (по телефону) заказ;
- смена статуса и склад персоналом;
- отмена черновика без движения склада;
- журнал с маскированием;
- HTTP:
  - без ключа и с отозванным ключом — 401;
  - ключ без `orders:write` не видит `update_order_status`.

**`packages/mcp/src/stdio.test.ts`** — настоящий процесс по stdio под гостем и под админом,
с `MCP_LOCALE=uz`.

**`e2e/console.spec.ts`:**

1. Админ создаёт ключ в консоли.
2. Официальный MCP-клиент по HTTP на `/api/mcp` ищет товары и создаёт черновик.
3. Покупатель подтверждает черновик по ссылке.
4. Вызов виден в журнале.
5. После отзыва ключа — 401.
