import { getDb } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { getHomeReviews, getReviewSummary } from '@redcore/services';
import { BadgeCheckIcon, QuoteIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Stars } from '@/features/product/reviews';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';
import { homeSection } from './section-header';

/** Меньше — секция выглядит пустой, и её не показываем. */
const MIN_REVIEWS = 3;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** «RedCore Ultra» уже содержит бренд — не повторяем его */
const productTitle = (brand: string, name: string) =>
  name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;

/**
 * Отзывы на главной: лучшие опубликованные отзывы на языке страницы (их одобряет модератор
 * в консоли) и сводка по всем отзывам. На телефоне карточки листаются вбок.
 */
export async function HomeReviews({ locale }: { locale: Locale }) {
  const db = await getDb();
  const [items, summary, t] = await Promise.all([
    getHomeReviews(db, locale),
    getReviewSummary(db),
    getTranslations({ locale, namespace: 'home.reviews' }),
  ]);
  if (items.length < MIN_REVIEWS) return null;
  const average = summary.average.toLocaleString(locale === 'uz' ? 'uz-Latn' : 'ru', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section className={cn(homeSection, 'space-y-6')} aria-labelledby="home-reviews">
      <Reveal stagger className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2
            id="home-reviews"
            className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl"
          >
            {t('title')}
          </h2>
          <p className="max-w-xl text-sm text-pretty text-steel-400">{t('subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-graphite-800 bg-graphite-900 px-5 py-4 shadow-panel">
          <span className="font-display text-4xl font-bold text-foreground">{average}</span>
          <div className="space-y-1">
            <Stars rating={summary.average} className="[&_svg]:size-4" />
            <p className="text-xs text-steel-300">
              {t('average')} · {t('basedOn', { count: summary.count })}
            </p>
          </div>
        </div>
      </Reveal>

      {/* Телефон: лента с прокруткой вбок (на всю ширину экрана), дальше — сетка */}
      <Reveal
        as="ul"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
      >
        {items.map((review) => (
          <li
            key={review.id}
            className="group relative flex w-[85%] shrink-0 snap-start flex-col gap-4 overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900 p-6 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow-lg sm:w-[60%] md:w-auto"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
            />
            <QuoteIcon
              aria-hidden="true"
              className="absolute top-5 right-5 size-10 fill-brand/10 text-brand/25"
            />
            <Stars rating={review.rating} className="[&_svg]:size-4" />
            <blockquote className="flex-1 leading-relaxed text-pretty text-foreground/90">
              {review.text}
            </blockquote>
            <div className="flex items-center gap-3 border-t border-graphite-800 pt-4">
              <span
                aria-hidden="true"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-cta font-display text-sm font-bold text-white shadow-glow-sm"
              >
                {initials(review.authorName)}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-1.5 font-semibold">
                  {review.authorName}
                  {review.verifiedPurchase > 0 && (
                    <BadgeCheckIcon
                      className="size-4 shrink-0 text-success"
                      aria-label={t('verified')}
                    />
                  )}
                </p>
                <Link
                  href={`/p/${review.productSlug}`}
                  className="block truncate text-xs text-steel-400 transition-colors hover:text-brand-bright"
                  title={productTitle(review.brandName, review.productName)}
                >
                  <span className="sr-only">{t('about')}: </span>
                  {productTitle(review.brandName, review.productName)}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
