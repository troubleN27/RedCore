import { isLocale } from '@redcore/i18n';
import { getFeaturedProducts, getPrebuilts } from '@redcore/services';
import { ArrowRightIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryTile } from '@/features/catalog/category-tile';
import { ProductGrid } from '@/features/catalog/product-grid';
import { BuildCard } from '@/features/home/build-card';
import { Features } from '@/features/home/features';
import { Hero } from '@/features/home/hero';
import { Link } from '@/i18n/navigation';
import { getChipNames, getPerf, getSnapshot } from '@/server/catalog';

export const revalidate = 300;

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [snapshot, perf, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getPerf(),
    getChipNames(),
    getTranslations({ locale, namespace: 'shop.home' }),
  ]);
  const prebuilts = getPrebuilts(snapshot);
  const weekly = snapshot.bySlug.get('redcore-ultra') ?? prebuilts[0];
  const components = (weekly ? (snapshot.prebuiltComponents.get(weekly.slug) ?? []) : [])
    .map((slug) => snapshot.bySlug.get(slug))
    .filter((p) => p !== undefined);

  return (
    <>
      <Hero
        buildCard={
          weekly && (
            <BuildCard
              prebuilt={weekly}
              components={components}
              categories={snapshot.categories}
              perf={perf}
            />
          )
        }
      />
      <Features />
      <section className="mx-auto mt-16 max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {t('categoriesTitle')}
          </h2>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-sm text-brand-bright hover:underline"
          >
            {t('allCatalog')}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.categories
            .filter((c) => c.kind === 'component')
            .map((category) => (
              <CategoryTile key={category.slug} category={category} />
            ))}
        </div>
      </section>
      <section className="mx-auto mt-16 max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t('featuredTitle')}
        </h2>
        <ProductGrid products={getFeaturedProducts(snapshot, 8)} chipNames={chipNames} />
      </section>
      <section className="mx-auto mt-16 max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {t('prebuiltTitle')}
          </h2>
          <Link
            href="/prebuilt"
            className="inline-flex items-center gap-1 text-sm text-brand-bright hover:underline"
          >
            {t('allPrebuilt')}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <ProductGrid products={prebuilts.slice(0, 4)} chipNames={chipNames} priorityCount={0} />
      </section>
    </>
  );
}
