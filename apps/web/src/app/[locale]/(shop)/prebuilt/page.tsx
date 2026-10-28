import { isLocale } from '@redcore/i18n';
import { getPrebuilts } from '@redcore/services';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { ProductGrid } from '@/features/catalog/product-grid';
import { localizedAlternates } from '@/lib/seo';
import { getChipNames, getSnapshot } from '@/server/catalog';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/prebuilt'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.prebuilt' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/prebuilt'),
  };
}

export default async function PrebuiltPage({ params }: PageProps<'/[locale]/prebuilt'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [snapshot, chipNames, t, tc] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'shop.prebuilt' }),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-3xl text-steel-300">{t('subtitle')}</p>
      </header>
      {/* Заголовок для скринридеров: карточки (h3) не идут сразу после h1 */}
      <h2 className="sr-only">{tc('productsHeading')}</h2>
      <ProductGrid products={getPrebuilts(snapshot)} chipNames={chipNames} />
    </div>
  );
}
