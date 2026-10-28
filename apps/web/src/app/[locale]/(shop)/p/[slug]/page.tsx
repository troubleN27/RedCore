import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { getMessages } from '@redcore/i18n/messages';
import {
  getApprovedReviews,
  getCompatibleProducts,
  getFeaturedProducts,
  getProductDetail,
  getSimilarProducts,
} from '@redcore/services';
import { CreditCardIcon, MessageSquareIcon, ShieldCheckIcon, TruckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, breadcrumbJsonLd } from '@/features/catalog/breadcrumbs';
import { AddToCartButton, CompareButton, FavoriteButton } from '@/features/catalog/product-actions';
import { ProductGrid } from '@/features/catalog/product-grid';
import { formatSpecs } from '@/features/product/spec-format';
import { ReviewForm, Stars } from '@/features/product/reviews';
import { ProductViewer } from '@/features/product/product-viewer';
import { SpecTable } from '@/features/product/spec-table';
import { Link } from '@/i18n/navigation';
import { absoluteUrl, jsonLdScript, localizedAlternates } from '@/lib/seo';
import { getChipNames, getPerf, getSnapshot } from '@/server/catalog';

export const revalidate = 300;

/** Популярные товары собираются при деплое, остальные — при первом заходе (ISR). */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return getFeaturedProducts(await getSnapshot(params.locale), 12).map((p) => ({ slug: p.slug }));
}

const loadProduct = cache(async (locale: 'ru' | 'uz', slug: string) => {
  const snapshot = await getSnapshot(locale);
  return getProductDetail(await getDb(), snapshot, slug);
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/p/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await loadProduct(locale, slug);
  if (!product) return {};
  const t = await getTranslations({ locale, namespace: 'product' });
  const name = `${product.brand} ${product.name}`;
  const price = formatPrice(product.priceUzs, locale);
  return {
    title: { absolute: product.seoTitle ?? t('metaTitle', { name, price }) },
    description:
      product.seoDescription ??
      t('metaDescription', { name, description: product.shortDescription, price }),
    alternates: localizedAlternates(locale, `/p/${slug}`),
    openGraph: { type: 'website', title: name, description: product.shortDescription },
  };
}

export default async function ProductPage({ params }: PageProps<'/[locale]/p/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = await loadProduct(locale, slug);
  if (!product) notFound();

  const [snapshot, perf, chipNames, t, tc] = await Promise.all([
    getSnapshot(locale),
    getPerf(),
    getChipNames(),
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  const summary = snapshot.bySlug.get(slug)!;
  const specRows = formatSpecs(product.componentType, product.specs as Record<string, unknown>, {
    locale,
    dict: getMessages(locale).specs,
    chipNames,
  });
  const compatible = getCompatibleProducts(snapshot, perf, summary);
  const reviews = await getApprovedReviews(await getDb(), product.id, locale);
  const similar = getSimilarProducts(snapshot, summary);
  const categoryNames = new Map(snapshot.categories.map((c) => [c.componentType, c.name]));
  const fullName = `${product.brand} ${product.name}`;
  const url = absoluteUrl(`/${locale}/p/${slug}`);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: fullName,
      sku: product.sku,
      description: product.shortDescription,
      brand: { '@type': 'Brand', name: product.brand },
      category: product.category.name,
      url,
      offers: {
        '@type': 'Offer',
        price: product.priceUzs,
        priceCurrency: 'UZS',
        availability:
          product.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url,
        seller: { '@type': 'Organization', name: 'RedCore' },
      },
    },
    breadcrumbJsonLd([
      { name: tc('home'), url: absoluteUrl(`/${locale}`) },
      {
        name: product.category.name,
        url: absoluteUrl(`/${locale}/catalog/${product.category.slug}`),
      },
      { name: fullName, url },
    ]),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />

      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: tc('title'), href: '/catalog' },
            { label: product.category.name, href: `/catalog/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <ProductViewer
            product={{ componentType: product.componentType, specs: product.specs }}
            customUrl={product.model3d?.customUrl ?? null}
            poster={
              <ProductArt
                type={product.componentType}
                brand={product.brand}
                size="lg"
                className="h-full w-full rounded-none border-0"
              />
            }
          />

          <div className="space-y-6">
            <div className="space-y-2">
              <p className="label-caps text-brand-bright">{product.brand}</p>
              <h1 className="font-display text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                {product.name}
              </h1>
              <p className="text-steel-300">{product.shortDescription}</p>
              <p className="font-mono text-xs text-steel-400">{t('sku', { sku: product.sku })}</p>
            </div>

            <div className="space-y-4 rounded-xl border border-graphite-800 bg-graphite-900 p-5 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PriceTag
                  amount={product.priceUzs}
                  compareAt={product.compareAtPriceUzs ?? undefined}
                  size="lg"
                />
                {product.available > 0 ? (
                  <Badge variant={product.available <= 3 ? 'warning' : 'success'}>
                    {product.available <= 3
                      ? t('lowStock', { count: product.available })
                      : t('inStock', { count: product.available })}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t('outOfStock')}</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <AddToCartButton
                  slug={slug}
                  name={product.name}
                  disabled={product.available <= 0}
                  size="lg"
                  className="flex-1"
                />
                <CompareButton slug={slug} category={product.categorySlug} withLabel />
                <FavoriteButton slug={slug} className="size-10" />
              </div>
              <ul className="space-y-2 border-t border-graphite-800 pt-4 text-sm text-steel-300">
                <li className="flex gap-3">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
                  {t('warranty', { months: product.warrantyMonths })}
                </li>
                <li className="flex gap-3">
                  <TruckIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
                  {t('delivery')}
                </li>
                <li className="flex gap-3">
                  <CreditCardIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
                  {t('payment')}
                </li>
              </ul>
            </div>

            {product.components.length > 0 && (
              <div className="space-y-3">
                <h2 className="label-caps text-steel-300">{t('components')}</h2>
                <ul className="divide-y divide-graphite-800 rounded-xl border border-graphite-800">
                  {product.components.map((part) => (
                    <li
                      key={part.slug}
                      className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm"
                    >
                      <span className="shrink-0 label-caps text-steel-400">
                        {categoryNames.get(part.componentType)}
                      </span>
                      <Link
                        href={`/p/${part.slug}`}
                        className="truncate text-right hover:text-brand-bright"
                      >
                        {part.brand} {part.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-steel-400">{t('componentsHint')}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/configurator">{getMessages(locale).common.actions.buildPc}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="specs-title">
        <div className="space-y-4">
          <h2 id="specs-title" className="font-display text-xl font-bold">
            {t('specs')}
          </h2>
          <SpecTable rows={specRows} />
        </div>
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">{t('reviews')}</h2>
          {reviews.length === 0 ? (
            <p className="flex items-center gap-3 rounded-xl border border-dashed border-graphite-800 px-4 py-6 text-sm text-steel-300">
              <MessageSquareIcon className="size-5 text-steel-400" />
              {t('noReviews')}
            </p>
          ) : (
            <ul className="space-y-3" data-testid="product-reviews">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="space-y-1.5 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="font-medium">{r.authorName}</span>
                    <span className="text-xs text-steel-400">
                      {formatDate(r.createdAt, locale)}
                    </span>
                    {r.verifiedPurchase > 0 && (
                      <Badge variant="success">{t('verifiedPurchase')}</Badge>
                    )}
                  </div>
                  <p className="text-steel-300">{r.text}</p>
                  {r.pros && (
                    <p className="text-xs text-success">{`${t('reviewPros')}: ${r.pros}`}</p>
                  )}
                  {r.cons && (
                    <p className="text-xs text-danger">{`${t('reviewCons')}: ${r.cons}`}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ReviewForm productId={product.id} slug={product.slug} />
          {product.description && (
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold">{t('description')}</h2>
              <p className="leading-relaxed whitespace-pre-line text-steel-300">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </section>

      {compatible.length > 0 && (
        <section className="space-y-6" aria-labelledby="compatible-title">
          <div className="space-y-1">
            <h2 id="compatible-title" className="font-display text-xl font-bold">
              {t('compatible')}
            </h2>
            <p className="text-sm text-steel-300">{t('compatibleHint', { name: product.name })}</p>
          </div>
          {compatible.map((group) => (
            <div
              key={group.componentType}
              className="space-y-3"
              data-testid={`compatible-${group.componentType}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="label-caps text-brand-bright">
                  {categoryNames.get(group.componentType)}
                </h3>
                {group.total > group.items.length && (
                  <span className="text-xs text-steel-400">
                    {t('showAllCompatible', { count: group.total - group.items.length })}
                  </span>
                )}
              </div>
              <ProductGrid products={group.items} chipNames={chipNames} priorityCount={0} />
            </div>
          ))}
        </section>
      )}

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">{t('similar')}</h2>
          <ProductGrid products={similar} chipNames={chipNames} priorityCount={0} />
        </section>
      )}
    </div>
  );
}
