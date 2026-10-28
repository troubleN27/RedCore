'use server';

import { getDb } from '@redcore/db';
import { orderStatuses, type OrderStatus } from '@redcore/domain';
import {
  AdminValidationError,
  adjustStock,
  createApiKey,
  adminTransitionOrder,
  buildMockRefundEvent,
  createPromo,
  detachModel,
  importBenchmarksCsv,
  reviewDraft,
  updateAiSettings,
  type AiSettings,
  saveGame,
  sendTelegramTest,
  moderateReview,
  RefundError,
  requestRefund,
  revokeApiKey,
  saveProduct,
  setPromoActive,
  setUserBanned,
  setUserRole,
  updateService,
  updateStoreSettings,
  updateZone,
  type BenchmarkImportResult,
  type GameInput,
  type ProductInput,
} from '@redcore/services';
import { revalidatePath } from 'next/cache';
import { env } from '@/env';
import { routing } from '@/i18n/routing';
import { getGateway, paymentProvider, sendOrderNotifications } from './payments';
import { getTelegramNotifier } from './telegram';
import { audit, requireStaff, type ConsoleSection } from './staff';

export type ActionResult =
  { ok: true; id?: string } | { ok: false; error: string; fields?: string[] };

function refresh() {
  revalidatePath('/[locale]/console', 'layout');
}

/** Витрина: карточки товаров и каталог кэшируются (ISR) — сбрасываем после правок из консоли. */
function refreshStorefront() {
  // Шаблон маршрута — с группой (shop): без неё пререндер карточек не сбрасывался
  revalidatePath('/[locale]/(shop)/p/[slug]', 'page');
  revalidatePath('/[locale]/(shop)/catalog/[category]', 'page');
  revalidatePath('/[locale]', 'page');
}

/** Обёртка: гард роли, аудит и единый формат ошибок для всех действий консоли. */
async function run(
  section: ConsoleSection,
  action: string,
  entity: string,
  fn: (staff: {
    id: string;
    login: string;
  }) => Promise<{ id?: string | null; diff?: Record<string, unknown> } | void>,
): Promise<ActionResult> {
  const staff = await requireStaff(section);
  try {
    const result = (await fn(staff)) ?? {};
    await audit(
      { id: staff.id, login: staff.login },
      action,
      entity,
      result.id ?? null,
      result.diff,
    );
    refresh();
    return { ok: true, id: result.id ?? undefined };
  } catch (error) {
    if (error instanceof AdminValidationError)
      return { ok: false, error: 'invalid', fields: error.fields };
    if (error instanceof RefundError) return { ok: false, error: error.reason };
    console.error(`console action ${action} failed`, error);
    return { ok: false, error: 'failed' };
  }
}

// ── Заказы ──

export async function changeOrderStatusAction(orderId: string, to: string, note?: string) {
  return run('orders', 'order.status', 'order', async (staff) => {
    if (!(orderStatuses as readonly string[]).includes(to))
      throw new AdminValidationError(['status']);
    const db = await getDb();
    const { from, events } = await adminTransitionOrder(
      db,
      orderId,
      to as OrderStatus,
      staff.id,
      note?.trim() || undefined,
    );
    void sendOrderNotifications(events);
    return { id: orderId, diff: { status: { from, to }, note } };
  });
}

/**
 * Возврат: запрос уходит в Stripe (или мок-шлюз), статус меняет вебхук. Мок-шлюз
 * отправляет в вебхук charge.refunded так же, как это сделал бы Stripe.
 */
export async function refundOrderAction(
  orderId: string,
  input: { amountUzs?: number; restock: boolean; reason?: string },
) {
  return run('orders', 'order.refund', 'order', async (staff) => {
    const gateway = await getGateway();
    if (!gateway) throw new RefundError('no_payment');
    const db = await getDb();
    const result = await requestRefund(db, gateway, orderId, { ...input, staffId: staff.id });
    if (paymentProvider() === 'mock') {
      const { payload, signature } = buildMockRefundEvent({
        paymentIntentId: result.payment.paymentIntentId!,
        amountMinor: result.payment.amountMinor,
        refundedMinor: result.payment.refundedAfterMinor,
        currency: result.payment.currency,
      });
      await fetch(new URL('/api/webhooks/stripe', env.NEXT_PUBLIC_SITE_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
        body: payload,
      });
    }
    return {
      id: orderId,
      diff: {
        refundId: result.refundId,
        amountUzs: input.amountUzs ?? 'full',
        restock: input.restock,
      },
    };
  });
}

// ── Товары и склад ──

export async function saveProductAction(input: ProductInput, id?: string) {
  return run('products', id ? 'product.update' : 'product.create', 'product', async () => {
    const result = await saveProduct(await getDb(), input, id);
    refreshStorefront();
    return { id: result.id, diff: result.diff };
  });
}

export async function adjustStockAction(productId: string, delta: number, note: string) {
  return run('stock', 'stock.adjust', 'product', async () => {
    const { stockQty } = await adjustStock(await getDb(), productId, delta, note);
    refreshStorefront();
    return { id: productId, diff: { delta, note, stockQty } };
  });
}

export async function detachModelAction(productId: string) {
  return run('products', 'product.model3d.remove', 'product', async () => {
    await detachModel(await getDb(), productId);
    refreshStorefront();
    return { id: productId };
  });
}

// ── Отзывы и промокоды ──

export async function moderateReviewAction(id: string, status: 'approved' | 'rejected') {
  return run('reviews', `review.${status}`, 'review', async (staff) => {
    await moderateReview(await getDb(), id, status, staff.id);
    refreshStorefront();
    return { id };
  });
}

export async function createPromoAction(input: Parameters<typeof createPromo>[1]) {
  return run('promos', 'promo.create', 'promo', async () => {
    const row = await createPromo(await getDb(), input);
    return { id: row.id, diff: { code: row.code, type: row.type, value: row.value } };
  });
}

export async function togglePromoAction(id: string, isActive: boolean) {
  return run('promos', 'promo.toggle', 'promo', async () => {
    const row = await setPromoActive(await getDb(), id, isActive);
    return { id, diff: { code: row?.code, isActive } };
  });
}

// ── Игры калькулятора FPS ──

/** Калькулятор на /fps и панель конфигуратора читают игры — сбрасываем их страницы. */
function refreshFps() {
  // Конкретные адреса, а не шаблон маршрута: страницы лежат в группе (shop), и шаблон
  // '/[locale]/fps' в продакшен-сборке не сбрасывал пререндер /ru/fps (проверено E2E)
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/fps`);
    revalidatePath(`/${locale}/configurator`);
  }
}

export async function saveGameAction(id: string | null, input: GameInput) {
  return run('games', id ? 'game.update' : 'game.create', 'game', async () => {
    const row = await saveGame(await getDb(), id, input);
    refreshFps();
    return {
      id: row.id,
      diff: { slug: row.slug, cpuAlpha: input.cpuAlpha, isActive: input.isActive },
    };
  });
}

export async function importBenchmarksAction(
  text: string,
): Promise<({ ok: true } & BenchmarkImportResult) | { ok: false }> {
  const staff = await requireStaff('games');
  if (text.length > 500_000) return { ok: false };
  try {
    const result = await importBenchmarksCsv(await getDb(), text);
    await audit({ id: staff.id, login: staff.login }, 'game.benchmarks.import', 'game', null, {
      updated: result.updated,
      errors: result.errors.length,
    });
    refreshFps();
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    console.error('importBenchmarksAction failed', error);
    return { ok: false };
  }
}

// ── AI ──

export async function reviewAiDraftAction(id: string, decision: 'applied' | 'rejected') {
  return run('ai', `ai.draft.${decision}`, 'ai_draft', async (staff) => {
    await reviewDraft(await getDb(), id, decision, staff.id);
    if (decision === 'applied') refreshStorefront();
    return { id };
  });
}

export async function updateAiSettingsAction(input: AiSettings) {
  return run('settings', 'ai.settings.update', 'settings', async () => {
    await updateAiSettings(await getDb(), input);
    return { diff: { ...input } };
  });
}

/** Тестовое сообщение в админ-чат Telegram (в мок-режиме — в /dev/inbox). */
export async function sendTelegramTestAction() {
  return run('settings', 'telegram.test', 'settings', async () => {
    const sent = await sendTelegramTest(getTelegramNotifier());
    if (!sent) throw new AdminValidationError(['adminChatId']);
  });
}

// ── Только администратор ──

/** Новый ключ MCP: значение показывается один раз, в журнал пишется только префикс. */
export async function createApiKeyAction(input: {
  name: string;
  scopes: string[];
  userLogin?: string;
}): Promise<{ ok: true; key: string } | { ok: false; error: string; fields?: string[] }> {
  let key = '';
  const result = await run('mcp', 'mcp.key.create', 'api_key', async (staff) => {
    const created = await createApiKey(
      await getDb(),
      { ...input, scopes: input.scopes as never, userLogin: input.userLogin || undefined },
      staff.id,
    );
    key = created.key;
    return {
      id: created.id,
      diff: { name: input.name, prefix: created.prefix, scopes: created.scopes },
    };
  });
  return result.ok ? { ok: true, key } : result;
}

export async function revokeApiKeyAction(id: string) {
  return run('mcp', 'mcp.key.revoke', 'api_key', async () => {
    const row = await revokeApiKey(await getDb(), id);
    return { id, diff: { name: row?.name } };
  });
}

export async function setUserRoleAction(userId: string, role: string) {
  return run('users', 'user.role', 'user', async (staff) => {
    const change = await setUserRole(await getDb(), staff.id, userId, role);
    return { id: userId, diff: { role: change } };
  });
}

export async function setUserBannedAction(userId: string, banned: boolean) {
  return run('users', banned ? 'user.ban' : 'user.unban', 'user', async (staff) => {
    await setUserBanned(await getDb(), staff.id, userId, banned);
    return { id: userId };
  });
}

export async function updateSettingsAction(input: { usdUzsRate: number; phone: string }) {
  return run('settings', 'settings.update', 'settings', async () => {
    const data = await updateStoreSettings(await getDb(), input);
    return { id: 'store', diff: data };
  });
}

export async function updateZoneAction(id: string, input: Parameters<typeof updateZone>[2]) {
  return run('settings', 'zone.update', 'zone', async () => {
    const row = await updateZone(await getDb(), id, input);
    return { id, diff: { code: row?.code, ...input } };
  });
}

export async function updateServiceAction(
  id: string,
  input: { priceUzs: number; isActive: boolean },
) {
  return run('settings', 'service.update', 'service', async () => {
    const row = await updateService(await getDb(), id, input);
    return { id, diff: { key: row?.key, ...input } };
  });
}
