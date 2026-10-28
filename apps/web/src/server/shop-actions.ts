'use server';

import { getDb } from '@redcore/db';
import { isLocale, type Locale } from '@redcore/i18n';
import {
  buildMockEvent,
  canViewOrder,
  cancelOrderByCustomer,
  createTelegramLink,
  confirmDraftOrder,
  DraftConfirmError,
  CheckoutError,
  getOrderByNumber,
  getPaymentBySession,
  invalidateCatalogCache,
  mergeUserCart,
  mergeUserFavorites,
  PaymentNotAvailableError,
  placeOrder,
  quoteCart,
  replaceUserCart,
  replaceUserFavorites,
  saveAddress,
  startPayment,
  type CartLine,
  type PlaceOrderInput,
} from '@redcore/services';
import type { PromoError } from '@redcore/domain';
import { after } from 'next/server';
import { env } from '@/env';
import { getSession } from './auth';
import { getSnapshot } from './catalog';
import { chargeOptions, getGateway, paymentProvider, sendOrderNotifications } from './payments';

function localeOf(value: string): Locale {
  return isLocale(value) ? value : 'ru';
}

// ── Корзина ──

export interface CartQuoteResult {
  lines: {
    slug: string;
    name: string;
    brand: string;
    componentType: string;
    categorySlug: string;
    priceUzs: number;
    compareAtPriceUzs: number | null;
    qty: number;
    totalUzs: number;
    available: number;
  }[];
  missing: string[];
  subtotalUzs: number;
  discountUzs: number;
  deliveryUzs: number;
  servicesUzs: number;
  totalUzs: number;
  freeDeliveryRemainingUzs: number | null;
  promo: { code: string; applied: boolean; error?: PromoError } | null;
  services: { key: string; name: string; description: string; priceUzs: number }[];
  selectedServices: string[];
  zones: {
    code: string;
    name: string;
    priceUzs: number;
    freeFromUzs: number | null;
    etaMinDays: number;
    etaMaxDays: number;
    codAllowed: boolean;
    isPickup: boolean;
  }[];
  zoneCode: string;
  shortages: string[];
}

export async function quoteCartAction(input: {
  locale: string;
  items: CartLine[];
  zoneCode?: string;
  serviceKeys?: string[];
  promoCode?: string | null;
  phone?: string | null;
}): Promise<CartQuoteResult> {
  const session = await getSession();
  const [db, snapshot] = await Promise.all([getDb(), getSnapshot(localeOf(input.locale))]);
  const q = await quoteCart(db, snapshot, { ...input, userId: session?.user.id });
  return {
    lines: q.lines.map((l) => ({
      slug: l.product.slug,
      name: l.product.name,
      brand: l.product.brand,
      componentType: l.product.componentType,
      categorySlug: l.product.categorySlug,
      priceUzs: l.product.priceUzs,
      compareAtPriceUzs: l.product.compareAtPriceUzs,
      qty: l.qty,
      totalUzs: l.totalUzs,
      available: l.available,
    })),
    missing: q.missing,
    subtotalUzs: q.quote.subtotalUzs,
    discountUzs: q.quote.discountUzs,
    deliveryUzs: q.quote.deliveryUzs,
    servicesUzs: q.quote.servicesUzs,
    totalUzs: q.quote.totalUzs,
    freeDeliveryRemainingUzs: q.quote.freeDeliveryRemainingUzs,
    promo: q.quote.promo,
    services: q.services.map(({ key, name, description, priceUzs }) => ({
      key,
      name,
      description,
      priceUzs,
    })),
    selectedServices: q.selectedServices,
    zones: q.zones.map(({ id: _id, ...zone }) => zone),
    zoneCode: q.zone.code,
    shortages: q.shortages,
  };
}

/** Корзина и избранное браузера сливаются с аккаунтом после входа. */
export async function mergeAccountStateAction(local: {
  cart: CartLine[];
  favorites: string[];
}): Promise<{ cart: CartLine[]; favorites: string[] } | null> {
  const session = await getSession();
  if (!session) return null;
  const db = await getDb();
  // Гостевые заказы привязываются к аккаунту при входе — в хуке сессии Better Auth
  const [cart, favorites] = await Promise.all([
    mergeUserCart(db, session.user.id, local.cart),
    mergeUserFavorites(db, session.user.id, local.favorites),
  ]);
  return { cart, favorites };
}

export async function syncAccountStateAction(state: {
  cart: CartLine[];
  favorites: string[];
}): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const db = await getDb();
  await Promise.all([
    replaceUserCart(db, session.user.id, state.cart),
    replaceUserFavorites(db, session.user.id, state.favorites),
  ]);
}

// ── Оформление ──

export type PlaceOrderResult =
  | { ok: true; number: string; token: string; paymentMethod: 'card' | 'cod' }
  | { ok: false; error: CheckoutError['code'] | 'generic'; details?: string | string[] };

export async function placeOrderAction(
  locale: string,
  input: PlaceOrderInput & { saveAddress?: boolean },
): Promise<PlaceOrderResult> {
  const session = await getSession();
  const lang = localeOf(locale);
  try {
    const [db, snapshot] = await Promise.all([getDb(), getSnapshot(lang)]);
    const placed = await placeOrder(db, snapshot, input, {
      userId: session?.user.id,
      locale: lang,
      cardEnabled: paymentProvider() !== null,
    });
    if (!placed.reused) {
      // Остатки изменились — снимок каталога этого инстанса перечитается при следующем запросе
      invalidateCatalogCache();
      after(async () => {
        await sendOrderNotifications([
          { kind: 'created', card: placed.paymentMethod === 'card', orderId: placed.orderId },
        ]);
        if (session && input.saveAddress && input.address) {
          await saveAddress(db, session.user.id, {
            ...input.address,
            zoneCode: input.zoneCode,
            recipient: input.contact.name,
            phone: input.contact.phone,
          }).catch((error: unknown) => console.error('save address failed', error));
        }
      });
    }
    return {
      ok: true,
      number: placed.number,
      token: placed.accessToken,
      paymentMethod: placed.paymentMethod,
    };
  } catch (error) {
    if (error instanceof CheckoutError)
      return { ok: false, error: error.code, details: error.details };
    console.error('placeOrderAction failed', error);
    return { ok: false, error: 'generic' };
  }
}

async function authorizedOrder(number: string, token?: string | null) {
  const [db, session] = await Promise.all([getDb(), getSession()]);
  const view = await getOrderByNumber(db, number);
  if (!view) return null;
  const allowed = canViewOrder(view, {
    userId: session?.user.id,
    role: (session?.user as { role?: string } | undefined)?.role,
    token,
  });
  return allowed ? { db, view, session } : null;
}

export type StartPaymentResult =
  | {
      ok: true;
      provider: 'stripe' | 'mock';
      clientSecret: string;
      sessionId: string;
      expiresAt: string;
    }
  | { ok: false; error: 'not_found' | 'unavailable' | 'failed' };

export async function startPaymentAction(
  number: string,
  token?: string | null,
): Promise<StartPaymentResult> {
  const access = await authorizedOrder(number, token);
  if (!access) return { ok: false, error: 'not_found' };
  const gateway = await getGateway();
  if (!gateway) return { ok: false, error: 'unavailable' };
  try {
    const session = await startPayment(
      access.db,
      gateway,
      access.view.order.id,
      await chargeOptions(),
    );
    return {
      ok: true,
      provider: session.provider,
      clientSecret: session.clientSecret,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof PaymentNotAvailableError) return { ok: false, error: 'unavailable' };
    console.error('startPaymentAction failed', error);
    return { ok: false, error: 'failed' };
  }
}

const mockCards: Record<string, 'success' | 'declined'> = {
  '4242424242424242': 'success',
  '4000002500003155': 'success',
  '4000000000009995': 'declined',
  '4000000000000002': 'declined',
};

/**
 * Мок-оплата: строит событие в формате Stripe и отправляет его в наш же вебхук по HTTP.
 * Заказ меняет статус только в обработчике вебхука — как с настоящим Stripe.
 */
export async function mockPayAction(
  number: string,
  token: string | null,
  sessionId: string,
  action: { card: string } | { expire: true },
): Promise<{ ok: boolean; error?: 'unknown_card' | 'unavailable' }> {
  if (paymentProvider() !== 'mock') return { ok: false, error: 'unavailable' };
  const access = await authorizedOrder(number, token);
  if (!access) return { ok: false, error: 'unavailable' };
  const outcome = 'expire' in action ? 'expired' : mockCards[action.card.replace(/\D/g, '')];
  if (!outcome) return { ok: false, error: 'unknown_card' };

  const payment = await getPaymentBySession(access.db, sessionId);
  if (!payment || payment.orderId !== access.view.order.id)
    return { ok: false, error: 'unavailable' };
  const { payload, signature } = buildMockEvent(outcome, {
    id: sessionId,
    orderId: payment.orderId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });
  const response = await fetch(new URL('/api/webhooks/stripe', env.NEXT_PUBLIC_SITE_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
    body: payload,
  });
  return { ok: response.ok };
}

/** Подтверждение черновика от ассистента или MCP: резерв товара и переход в «Принят». */
export async function confirmDraftOrderAction(
  number: string,
  token?: string | null,
): Promise<
  { ok: true } | { ok: false; error: 'forbidden' | 'not_draft' | 'out_of_stock' | 'failed' }
> {
  const access = await authorizedOrder(number, token);
  if (!access) return { ok: false, error: 'forbidden' };
  try {
    await confirmDraftOrder(access.db, access.view.order.id, access.session?.user.id);
    const { order } = access.view;
    after(() =>
      sendOrderNotifications([
        { kind: 'created', card: order.paymentMethod === 'card', orderId: order.id },
      ]),
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof DraftConfirmError && error.reason !== 'not_found')
      return { ok: false, error: error.reason };
    console.error('confirmDraftOrderAction failed', error);
    return { ok: false, error: 'failed' };
  }
}

/** Deep-link на бота для подписки на статусы заказа (токен живёт 7 дней). */
export async function telegramLinkAction(
  number: string,
  token?: string | null,
): Promise<{ ok: true; url: string } | { ok: false }> {
  const access = await authorizedOrder(number, token);
  if (!access) return { ok: false };
  const link = await createTelegramLink(access.db, access.view.order.id);
  return { ok: true, url: link.url };
}

export async function cancelOrderAction(
  number: string,
  token?: string | null,
): Promise<{ ok: boolean }> {
  const access = await authorizedOrder(number, token);
  if (!access) return { ok: false };
  try {
    const events = await cancelOrderByCustomer(
      access.db,
      access.view.order.id,
      access.session?.user.id,
    );
    after(() => sendOrderNotifications(events));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
