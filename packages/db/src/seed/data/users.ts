import type { UserRole } from '../../schema';

/**
 * Демо-аккаунты. Вход — по логину и паролю: персонал в консоль (admin, manager), покупатель
 * на сайте — по номеру телефона. Почта у Better Auth обязательна, здесь она служебная.
 */
export const demoUsers: {
  id: string;
  name: string;
  username: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  locale: 'ru' | 'uz';
}[] = [
  {
    id: 'demo-admin',
    name: 'Администратор RedCore',
    username: 'admin',
    email: 'admin@users.redcore.local',
    phoneNumber: '+998900000001',
    role: 'admin',
    locale: 'ru',
  },
  {
    id: 'demo-manager',
    name: 'Менеджер RedCore',
    username: 'manager',
    email: 'manager@users.redcore.local',
    phoneNumber: '+998900000002',
    role: 'manager',
    locale: 'ru',
  },
  {
    id: 'demo-customer',
    name: 'Azizbek Karimov',
    username: '998901234567',
    email: '998901234567@users.redcore.local',
    phoneNumber: '+998901234567',
    role: 'customer',
    locale: 'uz',
  },
];

/**
 * Пароль демо-персонала (логины admin и manager). В продакшене задайте SEED_STAFF_PASSWORD
 * перед `pnpm db:seed` и смените пароль после первого входа.
 */
export function staffPassword(): string {
  // Пустая переменная из скопированного .env.example — тоже значение по умолчанию
  return process.env.SEED_STAFF_PASSWORD?.trim() || 'RedCore-Staff-2026';
}

/** Пароль демо-покупателя (+998 90 123 45 67). */
export function customerPassword(): string {
  return process.env.SEED_CUSTOMER_PASSWORD?.trim() || 'RedCore-Demo-2026';
}
