import { normalizeUzPhone } from '@redcore/domain';

// Логин покупателя в Better Auth (плагин username) — его номер цифрами: 998901234567.
// Логины персонала — латиница (admin, manager), с номером они не пересекаются.

export const PHONE_LOGIN_RE = /^998\d{9}$/;

/** «+998 90 123-45-67» → «998901234567»; null — не узбекский номер. */
export function loginFromPhone(phone: string): string | null {
  return normalizeUzPhone(phone)?.slice(1) ?? null;
}

/** «998901234567» → «+998901234567» — так телефон хранится в профиле и заказах. */
export function phoneFromLogin(login: string): string {
  return `+${login}`;
}

/** Служебный адрес для Better Auth: почту магазин не собирает, но поле обязательно. */
export function internalEmail(login: string): string {
  return `${login}@users.redcore.local`;
}
