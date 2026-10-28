import {
  adminAuditLog,
  deliveryZones,
  orders,
  payments,
  services,
  session,
  settings,
  stripeEvents,
  user,
  type Database,
} from '@redcore/db';
import { and, asc, count, desc, eq, ilike, ne, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { AdminValidationError } from './catalog';
import { ADMIN_PAGE_SIZE } from './orders';

// ── Пользователи ──

export async function listUsers(db: Database, filter: { q?: string; page?: number }) {
  const page = Math.max(1, filter.page ?? 1);
  const conditions: SQL[] = [];
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    conditions.push(
      or(ilike(user.name, like), ilike(user.email, like), ilike(user.phoneNumber, like))!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        banned: user.banned,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(user).where(where),
  ]);
  return {
    rows,
    total: total?.n ?? 0,
    page,
    pages: Math.max(1, Math.ceil((total?.n ?? 0) / ADMIN_PAGE_SIZE)),
  };
}

const roleSchema = z.enum(['customer', 'manager', 'admin']);

/** Смена роли. Свою роль поменять нельзя — чтобы не остаться без администраторов. */
export async function setUserRole(db: Database, actorId: string, userId: string, role: string) {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success || actorId === userId) throw new AdminValidationError(['role']);
  const [before] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId));
  if (!before) throw new AdminValidationError(['id']);
  await db
    .update(user)
    .set({ role: parsed.data, updatedAt: new Date() })
    .where(eq(user.id, userId));
  // Новая роль действует со следующего входа: старые сессии закрываем
  await db.delete(session).where(eq(session.userId, userId));
  return { from: before.role, to: parsed.data };
}

export async function setUserBanned(
  db: Database,
  actorId: string,
  userId: string,
  banned: boolean,
) {
  if (actorId === userId) throw new AdminValidationError(['banned']);
  await db.update(user).set({ banned, updatedAt: new Date() }).where(eq(user.id, userId));
  if (banned) await db.delete(session).where(eq(session.userId, userId));
}

// ── Настройки ──

export interface StoreSettings {
  usdUzsRate: number;
  phone: string;
  email: string;
}

export async function getStoreSettings(db: Database): Promise<StoreSettings> {
  const rows = await db.select().from(settings);
  const pricing = rows.find((r) => r.key === 'pricing')?.value as
    { usdUzsRate?: number } | undefined;
  const store = rows.find((r) => r.key === 'store')?.value as
    { phone?: string; email?: string } | undefined;
  return {
    usdUzsRate: pricing?.usdUzsRate ?? 0,
    phone: store?.phone ?? '',
    email: store?.email ?? '',
  };
}

const settingsSchema = z.object({
  usdUzsRate: z.number().min(1000).max(100_000),
  phone: z.string().trim().min(5).max(40),
  email: z.email(),
});

export async function updateStoreSettings(db: Database, input: z.input<typeof settingsSchema>) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  const rows = await db.select().from(settings);
  const pricing = (rows.find((r) => r.key === 'pricing')?.value ?? {}) as Record<string, unknown>;
  const store = (rows.find((r) => r.key === 'store')?.value ?? {}) as Record<string, unknown>;
  const now = new Date();
  for (const [key, value] of [
    ['pricing', { ...pricing, usdUzsRate: parsed.data.usdUzsRate, rateSource: 'manual' }],
    ['store', { ...store, phone: parsed.data.phone, email: parsed.data.email }],
  ] as const) {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } });
  }
  return parsed.data;
}

export async function listZonesAdmin(db: Database) {
  return db.select().from(deliveryZones).orderBy(asc(deliveryZones.sort), asc(deliveryZones.code));
}

const zoneSchema = z.object({
  priceUzs: z.number().int().min(0).max(10_000_000),
  freeFromUzs: z.number().int().min(0).max(1_000_000_000).nullable(),
  etaMinDays: z.number().int().min(0).max(30),
  etaMaxDays: z.number().int().min(0).max(30),
  codAllowed: z.boolean(),
  isActive: z.boolean(),
});

export async function updateZone(db: Database, id: string, input: z.input<typeof zoneSchema>) {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success || parsed.data.etaMaxDays < parsed.data.etaMinDays)
    throw new AdminValidationError(['zone']);
  const [row] = await db
    .update(deliveryZones)
    .set(parsed.data)
    .where(eq(deliveryZones.id, id))
    .returning({ code: deliveryZones.code });
  return row ?? null;
}

export async function listServicesAdmin(db: Database) {
  return db.select().from(services).orderBy(asc(services.key));
}

export async function updateService(
  db: Database,
  id: string,
  input: { priceUzs: number; isActive: boolean },
) {
  const parsed = z
    .object({ priceUzs: z.number().int().min(0).max(100_000_000), isActive: z.boolean() })
    .safeParse(input);
  if (!parsed.success) throw new AdminValidationError(['service']);
  const [row] = await db
    .update(services)
    .set(parsed.data)
    .where(eq(services.id, id))
    .returning({ key: services.key });
  return row ?? null;
}

// ── Платежи и аудит ──

export async function listStripeEvents(db: Database, limit = 50) {
  return db
    .select({
      id: stripeEvents.id,
      type: stripeEvents.type,
      status: stripeEvents.status,
      error: stripeEvents.error,
      createdAt: stripeEvents.createdAt,
    })
    .from(stripeEvents)
    .orderBy(desc(stripeEvents.createdAt))
    .limit(limit);
}

export async function listPaymentRecords(db: Database, limit = 50) {
  return db
    .select({
      id: payments.id,
      provider: payments.provider,
      attempt: payments.attempt,
      amountMinor: payments.amountMinor,
      refundedMinor: payments.refundedMinor,
      currency: payments.currency,
      status: payments.status,
      failureCode: payments.failureCode,
      createdAt: payments.createdAt,
      orderNumber: orders.number,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function listAudit(db: Database, page = 1) {
  return db
    .select()
    .from(adminAuditLog)
    .where(ne(adminAuditLog.action, ''))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(ADMIN_PAGE_SIZE * 2)
    .offset((Math.max(1, page) - 1) * ADMIN_PAGE_SIZE * 2);
}
