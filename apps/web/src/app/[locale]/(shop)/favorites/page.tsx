import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { FavoritesView } from '@/features/catalog/favorites-view';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/favorites'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.favorites' });
  return { title: t('title'), robots: { index: false, follow: true } };
}

export default async function FavoritesPage({ params }: PageProps<'/[locale]/favorites'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'shop.favorites' });
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: t('title') }]} />
      <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
      <FavoritesView />
    </div>
  );
}
