import { formatPrice, isLocale } from '@redcore/i18n';
import { listCategoryPage, serializeCatalogQuery } from '@redcore/services';
import { SearchXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs, breadcrumbJsonLd } from '@/features/catalog/breadcrumbs';
import { FiltersPanel } from '@/features/catalog/filters-panel';
import { MobileFilters } from '@/features/catalog/mobile-filters';
import { Pagination } from '@/features/catalog/pagination';
import { ProductGrid } from '@/features/catalog/product-grid';
import { SortSelect } from '@/features/catalog/sort-select';
import { absoluteUrl, jsonLdScript, localizedAlternates } from '@/lib/seo';
import { getChipNames, getSnapshot } from '@/server/catalog';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/catalog/[category]'>): Promise<Metadata> {
  const [{ locale, category: slug }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) return {};
  const snapshot = await getSnapshot(locale);
  const category = snapshot.categories.find((c) => c.slug === slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const price = category.minPriceUzs !== null ? formatPrice(category.minPriceUzs, locale) : '';
  // Отфильтрованные выборки не индексируем — каноническая страница одна на категорию
  const filtered = Object.keys(query).length > 0;
  return {
    title: { absolute: t('metaCategory', { name: category.name, price }) },
    description: t('metaCategoryDescription', {
      name: category.name,
      count: category.productCount,
    }),
    alternates: localizedAlternates(locale, `/catalog/${slug}`),
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<'/[locale]/catalog/[category]'>) {
  const [{ locale, category: slug }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const [snapshot, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  const page = listCategoryPage(snapshot, slug, query);
  if (!page) notFound();

  const filterProps = {
    facets: page.facets,
    selection: page.query.filters,
    inStockOnly: page.query.inStockOnly,
    chipNames,
    total: page.total,
  };
  const hrefFor = (n: number) => {
    const params = serializeCatalogQuery({ ...page.query, page: n });
    const qs = params.toString();
    return `/catalog/${slug}${qs ? `?${qs}` : ''}`;
  };
  const jsonLd = breadcrumbJsonLd([
    { name: t('home'), url: absoluteUrl(`/${locale}`) },
    { name: t('title'), url: absoluteUrl(`/${locale}/catalog`) },
    { name: page.category.name, url: absoluteUrl(`/${locale}/catalog/${slug}`) },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <header className="space-y-3">
        <Breadcrumbs
          items={[{ label: t('title'), href: '/catalog' }, { label: page.category.name }]}
        />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {page.category.name}
        </h1>
        {page.category.description && (
          <p className="max-w-2xl text-steel-300">{page.category.description}</p>
        )}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label={t('filters')}>
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
            <FiltersPanel {...filterProps} />
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MobileFilters {...filterProps} />
            <p className="text-sm text-steel-400 lg:hidden">{t('found', { count: page.total })}</p>
            <div className="ml-auto">
              <SortSelect value={page.query.sort} />
            </div>
          </div>

          {page.items.length > 0 ? (
            <>
              {/* Заголовок для скринридеров: карточки (h3) не идут сразу после h1 */}
              <h2 className="sr-only">{t('productsHeading')}</h2>
              <ProductGrid products={page.items} chipNames={chipNames} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
              <SearchXIcon className="size-8 text-steel-400" />
              <p className="font-medium">{t('empty.title')}</p>
              <p className="text-sm text-steel-300">{t('empty.text')}</p>
            </div>
          )}

          <Pagination page={page.page} pageCount={page.pageCount} hrefFor={hrefFor} />
        </section>
      </div>
    </div>
  );
}
