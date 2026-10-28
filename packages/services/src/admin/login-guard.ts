import { adminLoginAttempts, type Database } from '@redcore/db';
import { eq, sql } from 'drizzle-orm';

export const MAX_LOGIN_FAILURES = 5;
export const LOCK_MINUTES = 15;

const keyOf = (email: string) => email.trim().toLowerCase();

/** Заблокирован ли вход для этого email и до какого момента. */
export async function loginLockedUntil(
  db: Database,
  email: string,
  now = new Date(),
): Promise<Date | null> {
  const [row] = await db
    .select()
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.key, keyOf(email)));
  return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null;
}

/**
 * Неудачная попытка. На пятой подряд — блокировка на 15 минут; счётчик после неё
 * начинается заново, чтобы следующая серия тоже упиралась в лимит.
 */
export async function recordLoginFailure(
  db: Database,
  email: string,
  now = new Date(),
): Promise<{ failures: number; lockedUntil: Date | null }> {
  const [row] = await db
    .insert(adminLoginAttempts)
    .values({ key: keyOf(email), failures: 1, lastAttemptAt: now })
    .onConflictDoUpdate({
      target: adminLoginAttempts.key,
      set: { failures: sql`${adminLoginAttempts.failures} + 1`, lastAttemptAt: now },
    })
    .returning();
  if (row!.failures < MAX_LOGIN_FAILURES) return { failures: row!.failures, lockedUntil: null };
  const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
  await db
    .update(adminLoginAttempts)
    .set({ failures: 0, lockedUntil })
    .where(eq(adminLoginAttempts.key, keyOf(email)));
  return { failures: MAX_LOGIN_FAILURES, lockedUntil };
}

export async function resetLoginFailures(db: Database, email: string): Promise<void> {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.key, keyOf(email)));
}
