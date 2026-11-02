import { isLocale, locales } from '@redcore/i18n';
import { sortProducts } from '@redcore/services';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Reveal } from '@/components/motion/reveal';
import { Breadcrumbs, breadcrumbJsonLd } from '@/features/catalog/breadcrumbs';
import { CategoryCard } from '@/features/catalog/category-card';
import { categoryCover } from '@/features/catalog/covers';
import { catalogGroups, groupCategories, isCatalogGroupKey } from '@/features/catalog/groups';
import { ProductGrid } from '@/features/catalog/product-grid';
import { absoluteUrl, jsonLdScript, localizedAlternates } from '@/lib/seo';
import { getChipNames, getSnapshot } from '@/server/catalog';

export const revalidate = 300;

/** Сколько популярных товаров группы показать под разделами */
const POPULAR_LIMIT = 8;

export function generateStaticParams() {
  return locales.flatMap((locale) => catalogGroups.map((g) => ({ locale, group: g.key })));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/catalog/group/[group]'>): Promise<Metadata> {
  const { locale, group } = await params;
  if (!isLocale(locale) || !isCatalogGroupKey(group)) return {};
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return {
    title: t(`groups.${group}.name`),
    description: t(`groups.${group}.description`),
    alternates: localizedAlternates(locale, `/catalog/group/${group}`),
  };
}

export default async function CatalogGroupPage({
  params,
}: PageProps<'/[locale]/catalog/group/[group]'>) {
  const { locale, group: key } = await params;
  if (!isLocale(locale) || !isCatalogGroupKey(key)) notFound();
  const [snapshot, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  const group = groupCategories(snapshot.categories).find((g) => g.key === key);
  if (!group) notFound();
  const slugs = new Set(group.categories.map((c) => c.slug));
  const popular = sortProducts(
    snapshot.products.filter((p) => slugs.has(p.categorySlug)),
    'popular',
  ).slice(0, POPULAR_LIMIT);
  const name = t(`groups.${key}.name`);
  const jsonLd = breadcrumbJsonLd([
    { name: t('home'), url: absoluteUrl(`/${locale}`) },
    { name: t('title'), url: absoluteUrl(`/${locale}/catalog`) },
    { name, url: absoluteUrl(`/${locale}/catalog/group/${key}`) },
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <header className="space-y-3">
        <Breadcrumbs items={[{ label: t('title'), href: '/catalog' }, { label: name }]} />
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="inline-flex size-12 items-center justify-center rounded-xl border border-brand/30 bg-brand-deep text-brand-bright">
            <group.icon className="size-6" />
          </span>
          {name}
        </h1>
        <p className="max-w-2xl text-steel-300">{t(`groups.${key}.description`)}</p>
      </header>

      <Reveal stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {group.categories.map((category) => (
          <CategoryCard
            key={category.slug}
            category={category}
            cover={categoryCover(snapshot, category.slug)}
          />
        ))}
      </Reveal>

      {popular.length > 0 && (
        <section className="space-y-6">
          <Reveal as="header">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t('popularInGroup', { name })}
            </h2>
          </Reveal>
          <ProductGrid products={popular} chipNames={chipNames} priorityCount={0} reveal />
        </section>
      )}
    </div>
  );
}
