import { payments, type Database } from '@redcore/db';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';

// Платёжный шлюз за интерфейсом: Stripe (test mode) или мок для разработки без ключей.
// Мок не «оплачивает» заказ сам: он формирует события в формате Stripe, подписывает их
// и отправляет в тот же вебхук — заказ становится оплаченным только через вебхук.

export interface CheckoutSessionRequest {
  orderId: string;
  number: string;
  attempt: number;
  currency: 'uzs' | 'usd';
  amountMinor: number;
  lineItems: { name: string; amountMinor: number }[];
  email?: string | null;
  locale: 'ru' | 'uz';
  returnUrl: string;
  expiresAt: Date;
}

export interface CheckoutSessionInfo {
  status: 'open' | 'complete' | 'expired';
  clientSecret: string | null;
}

export interface PaymentGateway {
  provider: 'stripe' | 'mock';
  createCheckoutSession(
    request: CheckoutSessionRequest,
  ): Promise<{ sessionId: string; clientSecret: string }>;
  getCheckoutSession(sessionId: string): Promise<CheckoutSessionInfo>;
  /** Возврат по платежу; итог (charge.refunded) придёт вебхуком */
  createRefund(request: {
    paymentIntentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }>;
  /** Проверка подписи вебхука; бросает исключение при неверной подписи */
  constructEvent(rawBody: string, signature: string): Stripe.Event;
}

/** Stripe ограничивает срок сессии: от 30 минут до 24 часов. */
export const PAYMENT_WINDOW_MS = 31 * 60 * 1000;

export function createStripeGateway(secretKey: string, webhookSecret: string): PaymentGateway {
  const stripe = new Stripe(secretKey, { appInfo: { name: 'RedCore' } });
  return {
    provider: 'stripe',
    async createCheckoutSession(req) {
      const session = await stripe.checkout.sessions.create(
        {
          ui_mode: 'elements',
          mode: 'payment',
          // Каждая позиция — одной строкой с итоговой суммой: скидка промокода уже разложена
          // по позициям, и итог в Stripe совпадает с нашим до сума
          line_items: req.lineItems.map((item) => ({
            quantity: 1,
            price_data: {
              currency: req.currency,
              unit_amount: item.amountMinor,
              product_data: { name: item.name },
            },
          })),
          customer_email: req.email ?? undefined,
          // Узбекского в интерфейсе Stripe нет — форма на русском, всё вокруг неё на uz
          locale: 'ru',
          return_url: `${req.returnUrl}${req.returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
          expires_at: Math.floor(req.expiresAt.getTime() / 1000),
          metadata: { orderId: req.orderId, number: req.number, attempt: String(req.attempt) },
          payment_intent_data: { metadata: { orderId: req.orderId, number: req.number } },
        },
        { idempotencyKey: `order:${req.orderId}:checkout:${req.attempt}` },
      );
      if (!session.client_secret) throw new Error('Stripe session has no client_secret');
      return { sessionId: session.id, clientSecret: session.client_secret };
    },
    async getCheckoutSession(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const status: CheckoutSessionInfo['status'] =
        session.status === 'complete'
          ? 'complete'
          : session.status === 'expired'
            ? 'expired'
            : 'open';
      return { status, clientSecret: session.client_secret };
    },
    async createRefund({ paymentIntentId, amountMinor, idempotencyKey }) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, amount: amountMinor },
        { idempotencyKey },
      );
      return { refundId: refund.id };
    },
    constructEvent(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },
  };
}

// ── Мок ──

export const MOCK_WEBHOOK_SECRET = 'whsec_redcore_mock_gateway_local_only';
// Ключ нужен SDK только для конструктора: мок не ходит в сеть
const offlineStripe = new Stripe('sk_test_offline_mock_gateway');

export function createMockGateway(db: Database): PaymentGateway {
  return {
    provider: 'mock',
    async createCheckoutSession() {
      const sessionId = `cs_mock_${randomBytes(12).toString('hex')}`;
      return { sessionId, clientSecret: `${sessionId}_secret_${randomBytes(8).toString('hex')}` };
    },
    async getCheckoutSession(sessionId) {
      const [row] = await db
        .select()
        .from(payments)
        .where(eq(payments.checkoutSessionId, sessionId));
      if (!row) return { status: 'expired', clientSecret: null };
      return {
        status:
          row.status === 'succeeded' ? 'complete' : row.status === 'expired' ? 'expired' : 'open',
        clientSecret: `${sessionId}_secret_mock`,
      };
    },
    async createRefund() {
      return { refundId: `re_mock_${randomBytes(10).toString('hex')}` };
    },
    constructEvent(rawBody, signature) {
      return offlineStripe.webhooks.constructEvent(rawBody, signature, MOCK_WEBHOOK_SECRET);
    },
  };
}

export type MockOutcome = 'success' | 'declined' | 'expired';

/**
 * События, которые прислал бы Stripe для тестовых карт: 4242 → completed (paid),
 * 9995 → payment_intent.payment_failed (insufficient_funds), истечение → session.expired.
 */
export function buildMockEvent(
  outcome: MockOutcome,
  session: { id: string; orderId: string; amountMinor: number; currency: string },
): { payload: string; signature: string } {
  const created = Math.floor(Date.now() / 1000);
  const intentId = `pi_mock_${session.id.slice(8, 24)}`;
  const base = {
    id: `evt_mock_${randomBytes(10).toString('hex')}`,
    object: 'event',
    api_version: null,
    created,
    livemode: false,
  };
  const sessionObject = {
    id: session.id,
    object: 'checkout.session',
    amount_total: session.amountMinor,
    currency: session.currency,
    metadata: { orderId: session.orderId },
    payment_intent: intentId,
  };
  const event =
    outcome === 'success'
      ? {
          ...base,
          type: 'checkout.session.completed',
          data: { object: { ...sessionObject, status: 'complete', payment_status: 'paid' } },
        }
      : outcome === 'expired'
        ? {
            ...base,
            type: 'checkout.session.expired',
            data: { object: { ...sessionObject, status: 'expired', payment_status: 'unpaid' } },
          }
        : {
            ...base,
            type: 'payment_intent.payment_failed',
            data: {
              object: {
                id: intentId,
                object: 'payment_intent',
                amount: session.amountMinor,
                currency: session.currency,
                metadata: { orderId: session.orderId },
                last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' },
              },
            },
          };
  const payload = JSON.stringify(event);
  const signature = offlineStripe.webhooks.generateTestHeaderString({
    payload,
    secret: MOCK_WEBHOOK_SECRET,
  });
  return { payload, signature };
}

/** Подпись произвольного события — для тестов вебхука и CI без Stripe CLI. */
export function signTestEvent(payload: string, secret: string): string {
  return offlineStripe.webhooks.generateTestHeaderString({ payload, secret });
}

/** Событие charge.refunded, как его прислал бы Stripe: amount_refunded — накопительно. */
export function buildMockRefundEvent(payment: {
  paymentIntentId: string;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
}): { payload: string; signature: string } {
  const event = {
    id: `evt_mock_${randomBytes(10).toString('hex')}`,
    object: 'event',
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: 'charge.refunded',
    data: {
      object: {
        id: `ch_mock_${payment.paymentIntentId.slice(8)}`,
        object: 'charge',
        amount: payment.amountMinor,
        amount_refunded: payment.refundedMinor,
        currency: payment.currency,
        payment_intent: payment.paymentIntentId,
      },
    },
  };
  const payload = JSON.stringify(event);
  return {
    payload,
    signature: offlineStripe.webhooks.generateTestHeaderString({
      payload,
      secret: MOCK_WEBHOOK_SECRET,
    }),
  };
}
