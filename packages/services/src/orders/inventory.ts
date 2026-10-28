import { inventoryMovements, products, type Database } from '@redcore/db';
import { and, eq, gte, sql } from 'drizzle-orm';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

export class OutOfStockError extends Error {
  constructor(public readonly productIds: string[]) {
    super(`Out of stock: ${productIds.join(', ')}`);
  }
}

/**
 * Резерв под заказ. Условный UPDATE атомарен в Postgres: из двух параллельных покупок
 * последней единицы пройдёт только одна, вторая получит 0 строк и OutOfStockError.
 */
export async function reserveStock(
  tx: DbOrTx,
  orderId: string,
  lines: { productId: string; qty: number }[],
): Promise<void> {
  const failed: string[] = [];
  // Порядок по id — одинаковый у всех транзакций, без взаимных блокировок
  for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
    const updated = await tx
      .update(products)
      .set({ reservedQty: sql`${products.reservedQty} + ${line.qty}` })
      .where(
        and(
          eq(products.id, line.productId),
          eq(products.status, 'active'),
          gte(sql`${products.stockQty} - ${products.reservedQty}`, line.qty),
        ),
      )
      .returning({ id: products.id });
    if (updated.length === 0) failed.push(line.productId);
  }
  if (failed.length > 0) throw new OutOfStockError(failed);
  await tx.insert(inventoryMovements).values(
    lines.map((l) => ({
      productId: l.productId,
      orderId,
      delta: l.qty,
      reason: 'reserve' as const,
    })),
  );
}

/** Снятие резерва (отмена, истёк срок оплаты). */
export async function releaseStock(
  tx: DbOrTx,
  orderId: string,
  lines: { productId: string; qty: number }[],
): Promise<void> {
  for (const line of lines) {
    await tx
      .update(products)
      .set({ reservedQty: sql`greatest(${products.reservedQty} - ${line.qty}, 0)` })
      .where(eq(products.id, line.productId));
  }
  await tx.insert(inventoryMovements).values(
    lines.map((l) => ({
      productId: l.productId,
      orderId,
      delta: -l.qty,
      reason: 'release' as const,
    })),
  );
}

/** Окончательное списание: товар оплачен (карта) или передан в сборку (наложенный платёж). */
export async function commitStock(
  tx: DbOrTx,
  orderId: string,
  lines: { productId: string; qty: number }[],
): Promise<void> {
  for (const line of lines) {
    await tx
      .update(products)
      .set({
        stockQty: sql`${products.stockQty} - ${line.qty}`,
        reservedQty: sql`greatest(${products.reservedQty} - ${line.qty}, 0)`,
      })
      .where(eq(products.id, line.productId));
  }
  await tx.insert(inventoryMovements).values(
    lines.map((l) => ({
      productId: l.productId,
      orderId,
      delta: -l.qty,
      reason: 'commit' as const,
    })),
  );
}
