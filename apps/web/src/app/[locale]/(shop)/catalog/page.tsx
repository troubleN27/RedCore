import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { CategoryTile } from '@/features/catalog/category-tile';
import { localizedAlternates } from '@/lib/seo';
import { getSnapshot } from '@/server/catalog';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/catalog'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/catalog'),
  };
}

export default async function CatalogPage({ params }: PageProps<'/[locale]/catalog'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const snapshot = await getSnapshot(locale);

  const groups = [
    { key: 'components', items: snapshot.categories.filter((c) => c.kind === 'component') },
    { key: 'peripherals', items: snapshot.categories.filter((c) => c.kind === 'peripheral') },
    { key: 'prebuilt', items: snapshot.categories.filter((c) => c.kind === 'prebuilt') },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-steel-300">{t('subtitle')}</p>
      </header>
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <h2 className="label-caps text-brand-bright">{t(group.key)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((category) => (
              <CategoryTile key={category.slug} category={category} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
