import { isLocale } from '@redcore/i18n';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Reveal } from '@/components/motion/reveal';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { CategoryCard } from '@/features/catalog/category-card';
import { categoryCover } from '@/features/catalog/covers';
import { groupCategories } from '@/features/catalog/groups';
import { Link } from '@/i18n/navigation';
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

  const groups = groupCategories(snapshot.categories);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-steel-300">{t('subtitle')}</p>
      </header>
      {groups.map((group) => (
        <Reveal
          as="section"
          key={group.key}
          className="space-y-4"
          aria-labelledby={`group-${group.key}`}
        >
          <div className="flex items-end justify-between gap-4 border-b border-graphite-800 pb-3">
            <h2
              id={`group-${group.key}`}
              className="flex items-center gap-3 font-display text-xl font-bold tracking-tight sm:text-2xl"
            >
              {t(`groups.${group.key}.name`)}
            </h2>
            {group.categories.length > 1 && (
              <Link
                href={`/catalog/group/${group.key}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-bright hover:underline"
              >
                {t('viewAll')}
                <ArrowRightIcon className="size-4" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {group.categories.map((category) => (
              <CategoryCard
                key={category.slug}
                category={category}
                cover={categoryCover(snapshot, category.slug)}
              />
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}
