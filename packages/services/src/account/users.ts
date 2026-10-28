import { user, type Database } from '@redcore/db';
import { normalizeUzPhone } from '@redcore/domain';
import { eq } from 'drizzle-orm';

/**
 * Пользователь по логину: у персонала — admin, manager; у покупателя логин — номер, и его можно
 * указать в любом виде («+998 90 123 45 67», «901234567»).
 */
export async function findUserIdByLogin(db: Database, value: string): Promise<string | null> {
  const login = normalizeUzPhone(value)?.slice(1) ?? value.trim().toLowerCase();
  if (!login) return null;
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.username, login));
  return row?.id ?? null;
}
