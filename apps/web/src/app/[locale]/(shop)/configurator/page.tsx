import { pcComponentTypes } from '@redcore/domain';
import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Configurator } from '@/features/configurator/configurator';
import { toConfigProduct, type BuildItem } from '@/features/configurator/types';
import { localizedAlternates } from '@/lib/seo';
import { loadSavedBuild } from '@/server/builds';
import { getChipNames, getPerf, getSnapshot } from '@/server/catalog';
import { getFps } from '@/server/fps';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/configurator'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'configurator' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/configurator'),
  };
}

const pcTypes = new Set<string>(pcComponentTypes);

export default async function ConfiguratorPage({
  params,
  searchParams,
}: PageProps<'/[locale]/configurator'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { build } = await searchParams;
  const publicId = typeof build === 'string' ? build : undefined;

  const [snapshot, perf, chipNames, saved, t, fps] = await Promise.all([
    getSnapshot(locale),
    getPerf(),
    getChipNames(),
    publicId ? loadSavedBuild(locale, publicId) : null,
    getTranslations({ locale, namespace: 'configurator' }),
    getFps(),
  ]);

  // В браузер уходят только комплектующие ПК и только нужные движку поля
  const products = snapshot.products
    .filter((p) => pcTypes.has(p.componentType))
    .map(toConfigProduct);
  const shared = !publicId
    ? null
    : saved
      ? {
          publicId: saved.publicId,
          items: saved.lines.map((l): BuildItem => ({
            slot: l.slot,
            slug: l.product.slug,
            qty: l.qty,
          })),
        }
      : ('not-found' as const);

  return (
    <div className="mx-auto max-w-[96rem] space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="text-steel-300">{t('subtitle')}</p>
      </header>
      <Configurator
        products={products}
        perf={perf}
        chipNames={chipNames}
        shared={shared}
        fps={{ games: fps.games, model: fps.model }}
      />
    </div>
  );
}
