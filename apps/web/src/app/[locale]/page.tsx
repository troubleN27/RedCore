import { isLocale } from '@redcore/i18n';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CatalogMosaic } from '@/features/catalog/catalog-mosaic';
import { ProductGrid } from '@/features/catalog/product-grid';
import { AboutTeaser } from '@/features/home/about-teaser';
import { getBestsellers } from '@/features/home/bestsellers';
import { BannerMosaic } from '@/features/home/banner-mosaic';
import { ConfiguratorShowcase } from '@/features/home/configurator-showcase';
import { Hero } from '@/features/home/hero';
import { HomeReviews } from '@/features/home/home-reviews';
import { Promotions } from '@/features/home/promotions';
import { homeSection, SectionHeader } from '@/features/home/section-header';
import { cn } from '@/lib/utils';
import { getChipNames, getSnapshot } from '@/server/catalog';

export const revalidate = 300;

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [snapshot, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'shop.home' }),
  ]);

  return (
    <>
      <Hero />
      <section className={cn(homeSection, 'space-y-6')}>
        <SectionHeader
          title={t('categoriesTitle')}
          subtitle={t('categoriesSubtitle')}
          link={{ href: '/catalog', label: t('allCatalog') }}
        />
        <CatalogMosaic snapshot={snapshot} />
      </section>
      <section className={cn(homeSection, 'space-y-6')}>
        <SectionHeader
          title={t('featuredTitle')}
          link={{ href: '/catalog', label: t('allCatalog') }}
        />
        <ProductGrid
          products={getBestsellers(snapshot)}
          chipNames={chipNames}
          reveal
          scrollOnMobile
        />
      </section>
      <ConfiguratorShowcase />
      <section className={cn(homeSection, 'space-y-6')}>
        <SectionHeader title={t('bannersTitle')} link={{ href: '/new', label: t('allNew') }} />
        <BannerMosaic />
      </section>
      <Promotions />
      <AboutTeaser />
      <HomeReviews locale={locale} />
    </>
  );
}
