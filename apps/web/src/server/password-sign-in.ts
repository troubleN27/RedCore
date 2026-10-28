import 'server-only';
import { getDb } from '@redcore/db';
import { loginLockedUntil, recordLoginFailure, resetLoginFailures } from '@redcore/services';
import { headers } from 'next/headers';
import { getAuth } from './auth';

export type SignInResult =
  | { status: 'ok'; userId: string; role: string }
  | { status: 'error'; error: 'invalid' | 'locked'; until?: string };

const STAFF_ROLES = new Set(['admin', 'manager']);

/**
 * Вход по логину и паролю с блокировкой после 5 ошибок подряд (на 15 минут). Консоль пускает
 * только персонал, витрина — только покупателей: чужая роль — та же ошибка «неверный логин»,
 * а сессия сразу закрывается.
 */
export async function signInWithPassword(
  login: string,
  password: string,
  audience: 'staff' | 'customer',
): Promise<SignInResult> {
  const db = await getDb();
  const locked = await loginLockedUntil(db, login);
  if (locked) return { status: 'error', error: 'locked', until: locked.toISOString() };

  const auth = await getAuth();
  try {
    const result = (await auth.api.signInUsername({
      body: { username: login, password },
      headers: await headers(),
    })) as { user?: { id: string; role?: string } } | null;
    const user = result?.user;
    if (!user) throw new Error('no user');
    const role = user.role ?? 'customer';
    if (STAFF_ROLES.has(role) !== (audience === 'staff')) {
      await auth.api.signOut({ headers: await headers() });
      throw new Error('wrong audience');
    }
    await resetLoginFailures(db, login);
    return { status: 'ok', userId: user.id, role };
  } catch {
    const { lockedUntil } = await recordLoginFailure(db, login);
    return lockedUntil
      ? { status: 'error', error: 'locked', until: lockedUntil.toISOString() }
      : { status: 'error', error: 'invalid' };
  }
}
