'use server';

import { getDb, user } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { internalEmail, loginFromPhone, phoneFromLogin } from '@/lib/login';
import { getAuth, MIN_PASSWORD_LENGTH } from './auth';
import { signInWithPassword } from './password-sign-in';

const MAX_PASSWORD_LENGTH = 128;

export type RegisterResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalidPhone' | 'passwordShort' | 'passwordMismatch' | 'phoneTaken' | 'generic';
    };

/** Регистрация покупателя: номер телефона, пароль и его подтверждение. Сразу входит в аккаунт. */
export async function registerAction(input: {
  phone: string;
  password: string;
  confirm: string;
  locale: string;
}): Promise<RegisterResult> {
  const login = loginFromPhone(input.phone);
  if (!login) return { ok: false, error: 'invalidPhone' };
  if (input.password.length < MIN_PASSWORD_LENGTH || input.password.length > MAX_PASSWORD_LENGTH)
    return { ok: false, error: 'passwordShort' };
  if (input.password !== input.confirm) return { ok: false, error: 'passwordMismatch' };

  const db = await getDb();
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, login))
    .limit(1);
  if (existing) return { ok: false, error: 'phoneTaken' };

  const auth = await getAuth();
  try {
    await auth.api.signUpEmail({
      body: {
        email: internalEmail(login),
        password: input.password,
        name: phoneFromLogin(login),
        username: login,
        locale: isLocale(input.locale) ? input.locale : 'ru',
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export type LoginResult =
  { ok: true } | { ok: false; error: 'invalidPhone' | 'invalid' | 'locked'; until?: string };

/** Вход покупателя: номер телефона и пароль, без SMS. */
export async function loginAction(input: {
  phone: string;
  password: string;
}): Promise<LoginResult> {
  const login = loginFromPhone(input.phone);
  if (!login) return { ok: false, error: 'invalidPhone' };
  if (!input.password || input.password.length > MAX_PASSWORD_LENGTH)
    return { ok: false, error: 'invalid' };
  const result = await signInWithPassword(login, input.password, 'customer');
  if (result.status === 'ok') return { ok: true };
  return { ok: false, error: result.error, until: result.until };
}
