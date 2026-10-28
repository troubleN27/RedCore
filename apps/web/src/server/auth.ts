import 'server-only';
import {
  account,
  getDb,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
  type Database,
} from '@redcore/db';
import { normalizeUzPhone } from '@redcore/domain';
import { isLocale, type Locale } from '@redcore/i18n';
import { claimGuestOrders, otpEmail, otpSms, sendEmail, sendSms } from '@redcore/services';
import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { headers } from 'next/headers';
import { cache } from 'react';
import { env } from '@/env';

const OTP_MINUTES = 5;
const STAFF_SIGN_IN_PATHS = new Set([
  '/sign-in/email',
  '/two-factor/verify-totp',
  '/two-factor/enable',
]);
// Только для локальной разработки и CI: в продакшене без BETTER_AUTH_SECRET сервер не стартует
const DEV_SECRET = 'redcore-dev-secret-do-not-use-in-production-0001';

function authSecret(): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && !process.env.CI) {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  return DEV_SECRET;
}

/** Язык писем и SMS — из cookie выбора языка (на странице входа она всегда есть). */
function localeFromRequest(request?: Request): Locale {
  const cookie = request?.headers.get('cookie') ?? '';
  const value = /(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/.exec(cookie)?.[1];
  return value && isLocale(value) ? value : 'ru';
}

function createAuth(db: Database) {
  return betterAuth({
    secret: authSecret(),
    baseURL: env.NEXT_PUBLIC_SITE_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, twoFactor: twoFactorTable },
    }),
    // Пароль — только у персонала (создаётся в seed/админке); покупатели входят по коду
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        locale: { type: 'string', required: false, defaultValue: 'ru', input: true },
      },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : undefined,
    rateLimit: { enabled: true, window: 60, max: 30 },
    databaseHooks: {
      session: {
        create: {
          // Персонал получает сессию только через пароль (+TOTP): вход по SMS/почте для
          // аккаунтов admin/manager закрыт, иначе 2FA можно было бы обойти
          async before(created, ctx) {
            const [row] = await db
              .select({ role: user.role })
              .from(user)
              .where(eq(user.id, created.userId));
            const staff = row?.role === 'admin' || row?.role === 'manager';
            if (staff && ctx?.path && !STAFF_SIGN_IN_PATHS.has(ctx.path)) return false;
            return { data: created };
          },
          // Гостевые заказы с подтверждённого номера сразу появляются в кабинете
          async after(created) {
            const [row] = await db
              .select({ phone: user.phoneNumber, verified: user.phoneNumberVerified })
              .from(user)
              .where(eq(user.id, created.userId));
            if (row?.phone && row.verified) await claimGuestOrders(db, created.userId, row.phone);
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_MINUTES * 60,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp }, ctx) {
          const locale = localeFromRequest(ctx?.request);
          await sendEmail(db, otpEmail(locale, email, otp, OTP_MINUTES));
        },
      }),
      phoneNumber({
        otpLength: 6,
        expiresIn: OTP_MINUTES * 60,
        allowedAttempts: 3,
        phoneNumberValidator: (value) => normalizeUzPhone(value) === value,
        signUpOnVerification: {
          // Почта обязательна для Better Auth: до привязки настоящей — служебный адрес
          getTempEmail: (value) => `${value.replace(/\D/g, '')}@phone.redcore.local`,
          getTempName: (value) => value,
        },
        async sendOTP({ phoneNumber: to, code }, ctx) {
          await sendSms(db, { to, text: otpSms(localeFromRequest(ctx?.request), code) });
        },
      }),
      admin({ defaultRole: 'customer', adminRoles: ['admin'] }),
      twoFactor({ issuer: 'RedCore', allowPasswordless: false }),
      // Должен быть последним: выставляет cookie из server actions
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let authPromise: Promise<Auth> | undefined;

/** Better Auth создаётся лениво: локальная PGlite-база поднимается асинхронно. */
export function getAuth(): Promise<Auth> {
  authPromise ??= getDb().then(createAuth);
  return authPromise;
}

/** Текущая сессия в серверных компонентах и actions (один запрос на рендер). */
export const getSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>['user'];
