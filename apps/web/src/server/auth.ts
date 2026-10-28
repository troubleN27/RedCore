import 'server-only';
import { account, getDb, session, user, verification, type Database } from '@redcore/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';
import { username } from 'better-auth/plugins/username';
import { headers } from 'next/headers';
import { cache } from 'react';
import { env } from '@/env';
import { PHONE_LOGIN_RE, phoneFromLogin } from '@/lib/login';

/** Минимальная длина пароля — и покупателя, и сотрудника. */
export const MIN_PASSWORD_LENGTH = 8;

// Только для локальной разработки и CI: в продакшене без BETTER_AUTH_SECRET сервер не стартует
const DEV_SECRET = 'redcore-dev-secret-do-not-use-in-production-0001';

function authSecret(): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && !process.env.CI) {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  return DEV_SECRET;
}

function createAuth(db: Database) {
  return betterAuth({
    secret: authSecret(),
    baseURL: env.NEXT_PUBLIC_SITE_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    // Логин + пароль. Регистрация и вход — только через server actions (HTTP закрыт в
    // /api/auth): там проверка телефона, подтверждение пароля и блокировка после 5 ошибок.
    // Better Auth требует email у пользователя — это служебный адрес, наружу он не показывается.
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        locale: { type: 'string', required: false, defaultValue: 'ru', input: true },
        phoneNumber: { type: 'string', required: false, input: false },
      },
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    databaseHooks: {
      user: {
        create: {
          // Логин покупателя — его номер: телефон в профиле заполняется из логина
          async before(created) {
            const login = (created as { username?: string }).username ?? '';
            if (!PHONE_LOGIN_RE.test(login)) return { data: created };
            return { data: { ...created, phoneNumber: phoneFromLogin(login) } };
          },
        },
      },
    },
    plugins: [
      // Логин персонала — admin, manager; покупателя — номер телефона цифрами (998901234567)
      username({ minUsernameLength: 3, maxUsernameLength: 30, displayUsername: false }),
      admin({ defaultRole: 'customer', adminRoles: ['admin'] }),
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
