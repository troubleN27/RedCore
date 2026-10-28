'use server';

import { getDb } from '@redcore/db';
import { loginLockedUntil, recordLoginFailure, resetLoginFailures } from '@redcore/services';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { z } from 'zod';
import { getAuth } from './auth';
import { audit, getStaff } from './staff';

export type LoginResult =
  | { status: 'totp' }
  | { status: 'enroll' }
  | { status: 'error'; error: 'invalid' | 'locked'; until?: string };

const credentialsSchema = z.object({
  email: z.email().max(120),
  password: z.string().min(1).max(200),
});

/**
 * Шаг 1 — пароль. Сессия появляется сразу только у сотрудника без 2FA, и с ней
 * доступна лишь страница подключения TOTP; с 2FA — Better Auth ждёт код (шаг 2).
 */
export async function staffLoginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', error: 'invalid' };
  const { email, password } = parsed.data;
  const db = await getDb();

  const locked = await loginLockedUntil(db, email);
  if (locked) return { status: 'error', error: 'locked', until: locked.toISOString() };

  const auth = await getAuth();
  try {
    const result = (await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    })) as {
      twoFactorRedirect?: boolean;
      user?: { id: string; role?: string };
    };
    if (result.twoFactorRedirect) return { status: 'totp' };
    const role = result.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      // Пароль подошёл, но это не сотрудник — для консоли такой вход недействителен
      await auth.api.signOut({ headers: await headers() });
      throw new Error('not staff');
    }
    await resetLoginFailures(db, email);
    await audit({ id: result.user!.id, email }, 'login.password', 'session');
    return { status: 'enroll' };
  } catch {
    const { lockedUntil } = await recordLoginFailure(db, email);
    await audit({ id: null, email }, lockedUntil ? 'login.locked' : 'login.failed', 'session');
    return lockedUntil
      ? { status: 'error', error: 'locked', until: lockedUntil.toISOString() }
      : { status: 'error', error: 'invalid' };
  }
}

/** Шаг 2 — код из приложения-аутентификатора. */
export async function staffVerifyTotpAction(code: string): Promise<{ ok: boolean }> {
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const auth = await getAuth();
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
    const staff = await getStaff();
    if (staff) {
      await resetLoginFailures(await getDb(), staff.email);
      await audit({ id: staff.id, email: staff.email }, 'login.totp', 'session');
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Подключение 2FA при первом входе: секрет, QR-код и резервные коды. */
export async function staffStartEnrollmentAction(
  password: string,
): Promise<{ ok: true; totpURI: string; qr: string; backupCodes: string[] } | { ok: false }> {
  const staff = await getStaff();
  if (!staff || staff.twoFactorEnabled) return { ok: false };
  const auth = await getAuth();
  try {
    const enabled = await auth.api.enableTwoFactor({
      body: { password, method: 'totp' } as { password: string },
      headers: await headers(),
    });
    if (!('totpURI' in enabled)) return { ok: false };
    const { totpURI, backupCodes } = enabled;
    const qr = await QRCode.toDataURL(totpURI, {
      margin: 1,
      width: 220,
      color: { dark: '#0a0a0b', light: '#ffffff' },
    });
    return { ok: true, totpURI, qr, backupCodes };
  } catch {
    return { ok: false };
  }
}

export async function staffConfirmEnrollmentAction(code: string): Promise<{ ok: boolean }> {
  const staff = await getStaff();
  if (!staff || !/^\d{6}$/.test(code)) return { ok: false };
  const auth = await getAuth();
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
    await audit({ id: staff.id, email: staff.email }, 'two_factor.enabled', 'user', staff.id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function staffLogoutAction(): Promise<void> {
  const staff = await getStaff();
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  if (staff) await audit({ id: staff.id, email: staff.email }, 'logout', 'session');
}
