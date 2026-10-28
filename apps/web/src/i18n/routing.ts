import { defaultLocale, locales } from '@redcore/i18n';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // /ru/… и /uz/… — у каждой локали свой URL для SEO (hreflang)
  localePrefix: 'always',
  // Корень «/» определяет язык по Accept-Language, иначе — ru
  localeDetection: true,
  // Выбор языка запоминается на год (по умолчанию next-intl ставит сессионную cookie)
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
