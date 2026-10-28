'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { getAuth } from './auth';
import { signInWithPassword } from './password-sign-in';
import { audit, getStaff } from './staff';

export type LoginResult =
  { status: 'ok' } | { status: 'error'; error: 'invalid' | 'locked'; until?: string };

const credentialsSchema = z.object({
  login: z.string().trim().toLowerCase().min(3).max(30),
  password: z.string().min(1).max(200),
});

/** Вход в консоль: логин сотрудника (admin, manager) и пароль. */
export async function staffLoginAction(input: {
  login: string;
  password: string;
}): Promise<LoginResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', error: 'invalid' };
  const { login, password } = parsed.data;

  const result = await signInWithPassword(login, password, 'staff');
  if (result.status === 'ok') {
    await audit({ id: result.userId, login }, 'login.password', 'session');
    return { status: 'ok' };
  }
  await audit(
    { id: null, login },
    result.error === 'locked' ? 'login.locked' : 'login.failed',
    'session',
  );
  return result;
}

export async function staffLogoutAction(): Promise<void> {
  const staff = await getStaff();
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  if (staff) await audit({ id: staff.id, login: staff.login }, 'logout', 'session');
}
