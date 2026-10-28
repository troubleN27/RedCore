import {
  addresses,
  cartItems,
  deliveryZones,
  products,
  wishlistItems,
  type Database,
} from '@redcore/db';
import { normalizeUzPhone } from '@redcore/domain';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { MAX_CART_QTY } from '../orders/checkout';

// Корзина и избранное аккаунта. Гость хранит их в браузере; после входа браузер
// присылает своё состояние, сервер сливает его с сохранённым и возвращает итог.

export type CartLine = { slug: string; qty: number };

/** Слияние корзин: по каждому товару — большее количество (повторный вход не удваивает корзину). */
export function mergeCartLines(server: CartLine[], local: CartLine[]): CartLine[] {
  const merged = new Map<string, number>();
  for (const line of [...server, ...local]) {
    merged.set(line.slug, Math.min(Math.max(merged.get(line.slug) ?? 0, line.qty), MAX_CART_QTY));
  }
  return [...merged].map(([slug, qty]) => ({ slug, qty }));
}

async function idsBySlug(db: Database, slugs: string[]) {
  if (slugs.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: products.id, slug: products.slug })
    .from(products)
    .where(inArray(products.slug, slugs));
  return new Map(rows.map((r) => [r.slug, r.id]));
}

export async function getUserCart(db: Database, userId: string): Promise<CartLine[]> {
  return db
    .select({ slug: products.slug, qty: cartItems.qty })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.updatedAt));
}

const linesSchema = z
  .array(
    z.object({ slug: z.string().min(1).max(200), qty: z.number().int().min(1).max(MAX_CART_QTY) }),
  )
  .max(60);

export async function replaceUserCart(
  db: Database,
  userId: string,
  lines: CartLine[],
): Promise<void> {
  const valid = linesSchema.parse(lines);
  const ids = await idsBySlug(
    db,
    valid.map((l) => l.slug),
  );
  await db.transaction(async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.userId, userId));
    const rows = valid
      .filter((l) => ids.has(l.slug))
      .map((l) => ({ userId, productId: ids.get(l.slug)!, qty: l.qty }));
    if (rows.length > 0) await tx.insert(cartItems).values(rows);
  });
}

export async function mergeUserCart(
  db: Database,
  userId: string,
  local: CartLine[],
): Promise<CartLine[]> {
  const merged = mergeCartLines(await getUserCart(db, userId), linesSchema.parse(local));
  await replaceUserCart(db, userId, merged);
  return merged;
}

export async function getUserFavorites(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
  return rows.map((r) => r.slug);
}

/** Избранное: объединение браузерного и сохранённого. */
export async function mergeUserFavorites(
  db: Database,
  userId: string,
  local: string[],
): Promise<string[]> {
  const slugs = z.array(z.string().min(1).max(200)).max(200).parse(local);
  const ids = await idsBySlug(db, slugs);
  if (ids.size > 0) {
    await db
      .insert(wishlistItems)
      .values([...ids.values()].map((productId) => ({ userId, productId })))
      .onConflictDoNothing();
  }
  return getUserFavorites(db, userId);
}

export async function replaceUserFavorites(
  db: Database,
  userId: string,
  local: string[],
): Promise<void> {
  const ids = await idsBySlug(db, z.array(z.string()).max(200).parse(local));
  await db.transaction(async (tx) => {
    await tx.delete(wishlistItems).where(eq(wishlistItems.userId, userId));
    if (ids.size > 0) {
      await tx
        .insert(wishlistItems)
        .values([...ids.values()].map((productId) => ({ userId, productId })));
    }
  });
}

// ── Адреса ──

export const addressSchema = z.object({
  zoneCode: z.string().min(1),
  recipient: z.string().trim().min(2).max(80),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeUzPhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'phone' });
    return n ?? z.NEVER;
  }),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).optional(),
  street: z.string().trim().min(2).max(120),
  house: z.string().trim().min(1).max(20),
  apartment: z.string().trim().max(20).optional(),
  landmark: z.string().trim().max(160).optional(),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressSchema>;

export async function listAddresses(db: Database, userId: string) {
  return db
    .select({ address: addresses, zoneCode: deliveryZones.code, zoneName: deliveryZones.name })
    .from(addresses)
    .innerJoin(deliveryZones, eq(deliveryZones.id, addresses.zoneId))
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function saveAddress(db: Database, userId: string, input: AddressInput, id?: string) {
  const data = addressSchema.parse(input);
  const [zone] = await db
    .select({ id: deliveryZones.id })
    .from(deliveryZones)
    .where(eq(deliveryZones.code, data.zoneCode));
  if (!zone) throw new Error('unknown zone');
  const { zoneCode: _zoneCode, ...fields } = data;
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, userId));
    // Первый адрес становится основным автоматически
    const isDefault = fields.isDefault || existing.length === 0;
    if (isDefault)
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    const values = { ...fields, isDefault, zoneId: zone.id, userId };
    if (id) {
      const [row] = await tx
        .update(addresses)
        .set(values)
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();
      return row ?? null;
    }
    const [row] = await tx.insert(addresses).values(values).returning();
    return row!;
  });
}

export async function deleteAddress(db: Database, userId: string, id: string): Promise<void> {
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
}
