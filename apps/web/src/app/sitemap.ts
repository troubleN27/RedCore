import type { MetadataRoute } from 'next';
import { groupCategories } from '@/features/catalog/groups';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/seo';
import { getSnapshot } from '@/server/catalog';

export const revalidate = 3600;

/** Карта сайта: каждая страница на обоих языках, с hreflang-альтернативами. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snapshot = await getSnapshot(routing.defaultLocale);
  const now = new Date();

  const entry = (
    path: string,
    priority: number,
    changeFrequency: 'daily' | 'weekly' = 'weekly',
  ): MetadataRoute.Sitemap => {
    const clean = path === '/' ? '' : path;
    const languages = Object.fromEntries(
      routing.locales.map((l) => [l, absoluteUrl(`/${l}${clean}`)]),
    );
    return routing.locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${clean}`),
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  };

  return [
    ...entry('/', 1, 'daily'),
    ...entry('/catalog', 0.9, 'daily'),
    ...entry('/prebuilt', 0.8),
    ...entry('/new', 0.7, 'daily'),
    ...['/about', '/contacts', '/why-redcore', '/offer', '/privacy', '/faq'].flatMap((path) =>
      entry(path, 0.4),
    ),
    ...['delivery', 'payment', 'warranty', 'returns'].flatMap((topic) =>
      entry(`/help/${topic}`, 0.3),
    ),
    ...groupCategories(snapshot.categories)
      .filter((g) => g.categories.length > 1)
      .flatMap((g) => entry(`/catalog/group/${g.key}`, 0.8)),
    ...snapshot.categories.flatMap((c) => entry(`/catalog/${c.slug}`, 0.8, 'daily')),
    ...snapshot.products.flatMap((p) => entry(`/p/${p.slug}`, p.isFeatured ? 0.7 : 0.6)),
  ];
}
