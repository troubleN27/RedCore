import type { Locale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { env } from '@/env';
import { routing } from '@/i18n/routing';

export function absoluteUrl(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

/** canonical и hreflang для пути без префикса локали: «/catalog/gpu». */
export function localizedAlternates(locale: Locale, path: string): Metadata['alternates'] {
  const clean = path === '/' ? '' : path;
  return {
    canonical: `/${locale}${clean}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${clean}`])),
      'x-default': `/${routing.defaultLocale}${clean}`,
    },
  };
}

/** Безопасная вставка JSON-LD: экранируем «<», чтобы строка не закрыла тег script. */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
