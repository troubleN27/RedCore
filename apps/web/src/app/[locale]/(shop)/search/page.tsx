import { isLocale } from '@redcore/i18n';
import { searchCatalog } from '@redcore/services';
import { SearchXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { CategoryTile } from '@/features/catalog/category-tile';
import { ProductGrid } from '@/features/catalog/product-grid';
import { SearchBox } from '@/features/search/search-box';
import { getChipNames, getSnapshot } from '@/server/catalog';

const readQuery = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.slice(0, 100) ?? '';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.search' });
  const q = readQuery(query.q);
  return {
    title: q ? t('metaTitle', { query: q }) : t('title'),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }: PageProps<'/[locale]/search'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const q = readQuery(query.q);
  const [snapshot, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'shop.search' }),
  ]);
  const result = q ? searchCatalog(snapshot, q, 48) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {q ? t('resultsFor', { query: q }) : t('title')}
        </h1>
        <Suspense>
          <SearchBox className="max-w-xl" autoFocus={!q} />
        </Suspense>
        {!q && <p className="text-sm text-steel-300">{t('hint')}</p>}
      </header>

      {result && result.categories.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-caps text-steel-300">{t('categories')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.categories.map((category) => (
              <CategoryTile key={category.slug} category={category} />
            ))}
          </div>
        </section>
      )}

      {result && result.items.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-caps text-steel-300">{t('products')}</h2>
          <ProductGrid products={result.items} chipNames={chipNames} />
        </section>
      )}

      {result && result.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
          <SearchXIcon className="size-8 text-steel-400" />
          <p className="font-medium">{t('nothing', { query: q })}</p>
          <p className="max-w-md text-sm text-steel-300">{t('hint')}</p>
        </div>
      )}
    </div>
  );
}
