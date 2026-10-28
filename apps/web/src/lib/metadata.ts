import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { NavKey } from '@/components/layout/nav-items';
import { routing } from '@/i18n/routing';

/** Заголовок страницы раздела по ключу навигации (на языке маршрута). */
export async function sectionMetadata(
  params: Promise<{ locale: string }>,
  section: NavKey | 'cart',
): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: t(section),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/${section}`])),
    },
  };
}
