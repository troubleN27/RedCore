# Запуск в продакшен: что сделать

Сайт работает без внешних сервисов: встроенный Postgres, мок-оплата, мок-Telegram,
детерминированный AI. Ниже — что подключить, чтобы всё работало «по-настоящему». Порядок —
по важности: без шагов 1–4 запускать в продакшен нельзя, остальное включается по мере готовности.

## 1. Git и GitHub

1. `git init`, первый коммит, приватный репозиторий на GitHub, `git push`.
2. CI (`.github/workflows/ci.yml`) запустится сам: формат, линт, типы, юнит-тесты, аудит
   зависимостей, бюджеты 3D, сборка, E2E.

## 2. База данных — Neon

1. Проект в [Neon](https://neon.tech), регион **AWS Europe Central 1 (Frankfurt)**.
2. Ветки: `main` — продакшен, `dev` — разработка.
3. В `.env.local` (ветка `dev`): `DATABASE_URL` (pooled, с `-pooler`) и `DATABASE_URL_UNPOOLED`.
4. `pnpm db:migrate && pnpm db:seed` → проверка: `/api/health` → `"db":"connected"`.
5. В GitHub → Settings → Environments → `production` → секрет `DATABASE_URL_UNPOOLED`
   (ветка `main`): миграции продакшена будет применять CI после каждого зелёного `main`.
6. Демо-данные в `main`: один раз `pnpm db:seed` со строкой `main`.

## 3. Деплой — Vercel

1. Импорт репозитория, **Root Directory — `apps/web`**, регион функций **fra1**.
2. Переменные окружения (Production):

| Переменная             | Значение                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | `https://<домен>`                                                      |
| `DATABASE_URL`         | pooled-строка ветки `main`                                             |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32` — **обязательно**, без него вход не работает |
| `BETTER_AUTH_URL`      | `https://<домен>`                                                      |
| `ADMIN_BASE_PATH`      | свой секретный путь консоли, например `/ops-7f3k2q` (не `/admin`)      |
| `SEED_STAFF_PASSWORD`  | пароль демо-сотрудников при seed (смените после первого входа)         |

3. Первый вход в консоль: `https://<домен><ADMIN_BASE_PATH>/login` → логин `admin` и пароль
   `SEED_STAFF_PASSWORD`.

## 4. Оплата — Stripe (test mode)

1. Аккаунт Stripe (или `stripe sandbox create`), ключи **test**:
   `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Dashboard → Webhooks → endpoint `https://<домен>/api/webhooks/stripe`, события
   `checkout.session.*`, `payment_intent.payment_failed`, `charge.refunded`, `refund.updated` →
   `STRIPE_WEBHOOK_SECRET`.
3. Локально: `stripe login`, `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
4. Проверка: карта 4242 → «оплачен» через вебхук; 4000 0025 0000 3155 — 3-D Secure;
   возврат из консоли → «возвращён» ([PAYMENTS.md](PAYMENTS.md)).

> Stripe не принимает Uzcard/Humo и не регистрирует мерчантов из Узбекистана — это демо.
> Для реальных продаж нужен Payme, Click или Uzum за тем же интерфейсом `PaymentGateway`.

## 5. Уведомления покупателю

Почты и SMS в проекте нет: покупатель входит по номеру телефона и паролю, а статусы заказа видит
на странице заказа и получает в Telegram (раздел 9). Пока у бота нет токена, Telegram работает в
мок-режиме: сообщения пишутся только в лог сервера.

## 6. Upstash Redis

`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — общие лимиты AI-чата для всех инстансов
Vercel (без Redis лимит считается в памяти каждой функции).

## 7. Gemini — AI-агенты

1. Ключ в [Google AI Studio](https://aistudio.google.com) → `GEMINI_API_KEY`.
2. Модели по умолчанию — в `.env.example`; `gemini-4-argon` (админ-агент) — только с биллингом.
3. Проверка: консоль → «AI» (пропадёт предупреждение о ключе) и сценарии из
   [AGENTS.md](AGENTS.md): «собери ПК для монтажа и игр до 15 млн» на RU и UZ, проверка сборки.

> На бесплатном тарифе Google может использовать данные для улучшения продуктов — с реальными
> клиентами подключите платный тариф.

## 8. Cloudflare R2

Бакет и токен API → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_URL` (публичный домен бакета). CORS бакета: `PUT` с домена сайта. Без R2 свои
3D-модели хранятся в базе (до 15 МБ).

## 9. Telegram

1. Бот в @BotFather → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
2. Админ-чат: добавьте бота в группу персонала, узнайте id чата → `TELEGRAM_ADMIN_CHAT_ID`.
3. `TELEGRAM_WEBHOOK_SECRET` — случайная строка; регистрация вебхука — в [TELEGRAM.md](TELEGRAM.md).
4. Консоль → «Настройки» → Telegram → «Тестовое сообщение».

## 10. 3D-модели (по желанию)

`SKETCHFAB_API_TOKEN` → `pnpm assets:fetch && pnpm assets:build && pnpm assets:report`
(или положите GLB вручную в `tooling/3d/raw/<ключ>/`). Без моделей работают процедурные.

## 11. Данные

- **Калькулятор FPS:** контрольные точки в `tooling/fps/data/control.csv` — приблизительная
  сводка обзоров, не замеры магазина. Снимите ≥ 60 своих замеров (по 4+ на игру) и запустите
  `pnpm fps:calibrate путь.csv -- --apply` ([FPS_METHOD.md](FPS_METHOD.md)).
- **Цены и остатки:** seed — демонстрационные; правятся в консоли («Товары», «Склад»).
- **Тексты правил** (доставка, гарантия, возврат) — `packages/i18n/messages/*/policies.json`:
  согласуйте с юристом.

## Проверка после запуска

- [ ] `/api/health` → `ok: true`, `db: connected`
- [ ] регистрация и вход по телефону и паролю, заказ, оплата картой 4242 → «оплачен», возврат из консоли
- [ ] консоль открывается только по `ADMIN_BASE_PATH`, `/admin` → 404
- [ ] Telegram — «Тестовое сообщение» и статус заказа после подписки
- [ ] AI-чат отвечает без плашки «AI недоступен»
- [ ] Lighthouse mobile ≥ 90 на главной, каталоге и карточке
