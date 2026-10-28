import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { FileDownIcon, PencilRulerIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Button } from '@/components/ui/button';
import { StockBadge } from '@/features/catalog/stock-badge';
import { AddBuildToCartButton, CopyLinkButton } from '@/features/configurator/build-actions';
import { BuildStatusLabel, IssueList, PowerMeter } from '@/features/configurator/compat-view';
import { pdfUrl } from '@/features/configurator/types';
import { Link } from '@/i18n/navigation';
import { absoluteUrl, localizedAlternates } from '@/lib/seo';
import { loadSavedBuild } from '@/server/builds';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/b/[publicId]'>): Promise<Metadata> {
  const { locale, publicId } = await params;
  if (!isLocale(locale)) return {};
  const saved = await loadSavedBuild(locale, publicId);
  if (!saved) return {};
  const [t, tc] = await Promise.all([
    getTranslations({ locale, namespace: 'configurator.share' }),
    getTranslations({ locale, namespace: 'compat.status' }),
  ]);
  const title = saved.name ? t('namedTitle', { name: saved.name }) : t('title');
  const description = t('metaDescription', {
    status: tc(saved.check.status),
    count: saved.lines.reduce((n, l) => n + l.qty, 0),
    amount: formatPrice(saved.check.totalUzs, locale),
  });
  return {
    title,
    description,
    alternates: localizedAlternates(locale, `/b/${publicId}`),
    // Сборки пользователей не индексируем: ссылки для того, чтобы делиться
    robots: { index: false, follow: true },
    openGraph: { type: 'website', title, description },
  };
}

export default async function SharedBuildPage({ params }: PageProps<'/[locale]/b/[publicId]'>) {
  const { locale, publicId } = await params;
  if (!isLocale(locale)) notFound();
  const saved = await loadSavedBuild(locale, publicId, true);
  if (!saved) notFound();
  const t = await getTranslations({ locale, namespace: 'configurator' });
  const shareUrl = absoluteUrl(`/${locale}/b/${publicId}`);
  const pieces = saved.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="label-caps text-brand-bright">{`RedCore · ${publicId}`}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {saved.name ? t('share.namedTitle', { name: saved.name }) : t('share.title')}
          </h1>
          <p className="text-sm text-steel-300">
            {[
              t('share.savedAt', { date: formatDate(saved.createdAt, locale) }),
              t('steps.itemsCount', { count: pieces }),
              t('share.views', { count: saved.viewCount }),
            ].join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/configurator?build=${publicId}`} data-testid="open-in-configurator">
              <PencilRulerIcon />
              {t('actions.edit')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={pdfUrl(publicId, locale)} data-testid="shared-pdf">
              <FileDownIcon />
              {t('actions.pdf')}
            </a>
          </Button>
          <CopyLinkButton url={shareUrl} publicId={publicId} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="components-title" className="space-y-3">
          <h2 id="components-title" className="text-lg font-semibold">
            {t('share.components')}
          </h2>
          <ul className="divide-y divide-white/5 rounded-xl border border-graphite-800 bg-graphite-900">
            {saved.lines.map((line) => (
              <li
                key={`${line.slot}-${line.product.slug}`}
                data-testid="shared-line"
                className="flex items-center gap-4 p-4"
              >
                <ProductArt
                  type={line.product.componentType}
                  brand={line.product.brand}
                  size="sm"
                  className="w-16 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="label-caps text-steel-400">{t(`slots.${line.slot}`)}</p>
                  <Link
                    href={`/p/${line.product.slug}`}
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
                    {`${line.product.brand} ${line.product.name}`}
                    {line.qty > 1 && ` ${t('share.qty', { qty: line.qty })}`}
                  </Link>
                  <StockBadge available={line.product.available} />
                </div>
                <PriceTag
                  amount={line.product.priceUzs * line.qty}
                  size="sm"
                  className="justify-end"
                />
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-5 rounded-2xl border border-white/10 bg-graphite-950/80 p-5 shadow-panel lg:self-start">
          <BuildStatusLabel status={saved.check.status} />
          {saved.check.issues.length > 0 ? (
            <IssueList issues={saved.check.issues} />
          ) : (
            <p className="text-sm text-steel-300">{t('summary.noIssues')}</p>
          )}
          <PowerMeter power={saved.check.power} />
          <div className="space-y-1 border-t border-white/5 pt-4">
            <span className="label-caps text-steel-400">{t('summary.total')}</span>
            <PriceTag amount={saved.check.totalUzs} size="lg" />
            {saved.savedTotalUzs !== saved.check.totalUzs && (
              <p className="text-xs text-steel-400">
                {t('share.pricesNote', { amount: formatPrice(saved.savedTotalUzs, locale) })}
              </p>
            )}
          </div>
          <AddBuildToCartButton
            className="w-full"
            publicId={publicId}
            lines={saved.lines.map((l) => ({
              slug: l.product.slug,
              name: l.product.name,
              qty: l.qty,
              available: l.product.available,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
