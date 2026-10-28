# Архитектура

Монорепо pnpm + Turborepo. Одно приложение Next.js 16 на Vercel и пакеты с логикой: те же
сервисы обслуживают сайт, консоль, MCP-клиентов, AI-агентов, скрипты и тесты.

```
 Браузер (RU/UZ)                             Внешние AI-клиенты (Claude Desktop, Cursor)
   │ RSC/SSR · server actions · SSE                │ stdio | Streamable HTTP + ключ rc_…
   ▼                                               ▼
 apps/web — Next.js 16 ─────────────────────────────────────────────────────────────────
   витрина · конфигуратор (3D) · /fps · кабинет · консоль по ADMIN_BASE_PATH
   /api/ai/chat (SSE) · /api/mcp · /api/webhooks/stripe · /api/webhooks/telegram · /api/auth/*
   │                          │
   ▼                          ▼
 packages/ai               packages/mcp
   оркестратор, 4 агента     createShopMcpServer({ actor, scopes, locale })
   GeminiGateway ⇄ Gemini    21 инструмент · ресурсы · промпты
   MCP Client ══ InMemory ══▶│
   └─────────────────────────▶ packages/services
                               каталог · поиск · сборки · checkout · платежи · консоль · FPS ·
                               MCP-ключи · AI-данные · уведомления (Telegram)
                                 ▼                           ▼
                   packages/domain (без IO)           packages/db (Drizzle)
                   совместимость · БП · FPS ·         Neon Postgres (или PGlite локально)
                   подбор · 3D-раскладка · деньги ·   внешние: Stripe · Gemini ·
                   статусы заказа · анализ баланса    Upstash · R2 · Telegram
```

## Принципы

- **Зависимости только вниз:** `web → ai → mcp → services → domain/db`. `domain` не делает IO и
  одинаково работает в браузере (конфигуратор считает совместимость на клиенте) и на сервере
  (сервер перепроверяет тем же кодом).
- **Одна операция — одна реализация.** Подбор сборки вызывают консультант (через MCP), обратный
  FPS и форма «Хочу N FPS»; статус заказа — страница заказа, поддержка и внешний MCP-клиент.
- **Факты — из базы.** Цены и остатки сервер пересчитывает при оформлении; карточки в чате
  строятся по slug из базы; оплата подтверждается только подписанным вебхуком.
- **Права — у инструмента.** MCP-сервер собирается с actor и scopes; модель или внешний клиент
  не могут их расширить. Запись от AI/MCP — только черновики с подтверждением человеком.
- **Работает без интеграций.** Каждая внешняя служба за интерфейсом с мок-реализацией:
  `PaymentGateway` (Stripe/мок), Telegram → `dev_outbox`, `LlmGateway`
  (Gemini/детерминированный режим), PGlite вместо Neon.

## Ключевые потоки

| Поток        | Путь                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Каталог      | RSC + пререндер; правки в консоли → `revalidatePath` с группой маршрутов `(shop)`                                            |
| Конфигуратор | store (Zustand) → `checkBuild` в браузере → 3D-раскладка `layoutBuild` → сцена R3F                                           |
| Заказ        | `placeOrder` (транзакция, резерв `SELECT … FOR UPDATE`) → Stripe Checkout Session → вебхук → «оплачен» → `after()`: Telegram |
| Возврат      | консоль → `requestRefund` (idempotency key) → вебхук `charge.refunded` → «возвращён» → Telegram                              |
| AI           | `/api/ai/chat` → лимиты → оркестратор → агент ⇄ MCP in-memory → SSE-события → `ai_runs`, `ai_tool_calls`                     |
| MCP          | `/api/mcp` → проверка ключа → сервер со scopes ключа → журнал вызовов                                                        |

## Безопасность

- Заголовки (`next.config.ts`): CSP со списком источников (Stripe, CDN Steam, R2),
  `object-src 'none'`, `frame-ancestors 'none'`, HSTS, `nosniff`, `X-Frame-Options`,
  Referrer-Policy, Permissions-Policy, COOP. CSP без nonce — осознанно: nonce сделал бы каждую
  страницу динамической и убрал пререндер каталога.
- Консоль: секретный путь (прямой `/…/console` → 404), логин и пароль, блокировка 5/15 мин,
  роли admin/manager, журнал действий.
- Вебхуки Stripe и Telegram проверяют подпись/секрет; MCP-ключи хранятся хэшами.
- PII в логах AI/MCP маскируется.

## Документы

[COMPATIBILITY](COMPATIBILITY.md) · [PAYMENTS](PAYMENTS.md) · [ADMIN](ADMIN.md) · [3D](3D.md) ·
[FPS_METHOD](FPS_METHOD.md) · [MCP](MCP.md) · [AGENTS](AGENTS.md) · [TELEGRAM](TELEGRAM.md) ·
[DEMO](DEMO.md) · [LAUNCH](LAUNCH.md)
