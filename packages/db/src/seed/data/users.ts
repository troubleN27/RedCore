import type { UserRole } from '../../schema';

/** Демо-аккаунты. Пароль и 2FA для админки появятся на этапе 5; покупатель входит по OTP. */
export const demoUsers: {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  locale: 'ru' | 'uz';
}[] = [
  {
    id: 'demo-admin',
    name: 'Администратор RedCore',
    email: 'admin@redcore.uz',
    phoneNumber: '+998900000001',
    role: 'admin',
    locale: 'ru',
  },
  {
    id: 'demo-manager',
    name: 'Менеджер RedCore',
    email: 'manager@redcore.uz',
    phoneNumber: '+998900000002',
    role: 'manager',
    locale: 'ru',
  },
  {
    id: 'demo-customer',
    name: 'Azizbek Karimov',
    email: 'customer@redcore.uz',
    phoneNumber: '+998901234567',
    role: 'customer',
    locale: 'uz',
  },
];

/**
 * Пароль демо-персонала (admin@redcore.uz, manager@redcore.uz). В продакшене задайте
 * SEED_STAFF_PASSWORD перед `pnpm db:seed` и смените пароль после первого входа.
 */
export function staffPassword(): string {
  // Пустая переменная из скопированного .env.example — тоже значение по умолчанию
  return process.env.SEED_STAFF_PASSWORD?.trim() || 'RedCore-Staff-2026';
}
