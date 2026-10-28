import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FpsCalculator } from '@/features/fps/fps-calculator';
import { localizedAlternates } from '@/lib/seo';
import { getFps, getPartLookup } from '@/server/fps';

export async function generateMetadata({ params }: PageProps<'/[locale]/fps'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'fps' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/fps'),
  };
}

export default async function FpsPage({ params }: PageProps<'/[locale]/fps'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [data, parts, t] = await Promise.all([
    getFps(),
    getPartLookup(locale),
    getTranslations({ locale, namespace: 'fps' }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="text-steel-300">{t('subtitle')}</p>
      </header>
      <FpsCalculator data={{ ...data, parts }} />
    </div>
  );
}
