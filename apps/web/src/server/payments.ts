import 'server-only';
import { getDb } from '@redcore/db';
import {
  createMockGateway,
  createStripeGateway,
  getUsdRate,
  notifyTelegramOrder,
  type OrderEvent,
  type PaymentGateway,
} from '@redcore/services';
import { env } from '@/env';
import { consoleUrl, getTelegramNotifier } from './telegram';

/**
 * Мок-оплата: без ключей Stripe в dev и в CI. В продакшене — только если явно включена
 * (PAYMENTS_MOCK=1) для демо-стенда; иначе оплата картой там просто недоступна.
 */
export function mockPaymentsEnabled(): boolean {
  if (env.STRIPE_SECRET_KEY) return false;
  return (
    process.env.NODE_ENV !== 'production' ||
    Boolean(process.env.CI) ||
    process.env.PAYMENTS_MOCK === '1'
  );
}

export function paymentProvider(): 'stripe' | 'mock' | null {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    return 'stripe';
  return mockPaymentsEnabled() ? 'mock' : null;
}

let stripeGateway: PaymentGateway | undefined;

export async function getGateway(): Promise<PaymentGateway | null> {
  const provider = paymentProvider();
  if (provider === 'stripe') {
    stripeGateway ??= createStripeGateway(env.STRIPE_SECRET_KEY!, env.STRIPE_WEBHOOK_SECRET!);
    return stripeGateway;
  }
  return provider === 'mock' ? createMockGateway(await getDb()) : null;
}

/** Курс для режима списания в USD — из настроек магазина (pricing.usdUzsRate). */
export async function chargeOptions() {
  const usdRate =
    env.PAYMENT_CHARGE_CURRENCY === 'usd' ? await getUsdRate(await getDb()) : undefined;
  return {
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    chargeCurrency: env.PAYMENT_CHARGE_CURRENCY,
    usdRate,
  };
}

/**
 * Уведомления о событиях заказа — Telegram (покупателю и в админ-чат). Ошибка бота не должна
 * ломать ответ; покупатель видит статус и на странице заказа.
 */
export async function sendOrderNotifications(
  events: (OrderEvent | { kind: 'created'; card: boolean; orderId: string })[],
): Promise<void> {
  const db = await getDb();
  const notifier = getTelegramNotifier();
  for (const event of events) {
    try {
      await notifyTelegramOrder(db, notifier, event.orderId, event, {
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
        consoleUrl: consoleUrl(),
      });
    } catch (error) {
      console.error('telegram notification failed', event, error);
    }
  }
}
