import { ArrowRightIcon, CalendarClockIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PromoCodeCopy } from './promo-code-copy';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';
import { homeSection, SectionHeader } from './section-header';

/**
 * Акции главной. Промокоды должны существовать в базе (packages/db/src/seed/data/commerce.ts,
 * `pnpm db:promos`), картинки — `/promos/<file>-640.webp` и `-960.webp`.
 */
const promos: { key: 'gpu' | 'kit' | 'pad'; file: string; code: string; href: string }[] = [
  { key: 'gpu', file: 'gpu20', code: 'GPU20', href: '/catalog/gpu' },
  { key: 'kit', file: 'ryzen-rog', code: 'RYZENROG', href: '/catalog/cpu' },
  { key: 'pad', file: 'pad-gift', code: 'PADGIFT', href: '/catalog/mice' },
];

export function Promotions() {
  const t = useTranslations('home.promos');

  return (
    <section className={cn(homeSection, 'space-y-6')}>
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />
      {/* Телефон: лента с прокруткой вбок, дальше — сетка */}
      <Reveal
        stagger
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
      >
        {promos.map((promo) => (
          <article
            key={promo.key}
            className="group relative flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow-lg sm:w-[60%] md:w-auto"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- фото заранее сжаты в WebP двух размеров */}
            <img
              src={`/promos/${promo.file}-960.webp`}
              srcSet={`/promos/${promo.file}-640.webp 640w, /promos/${promo.file}-960.webp 960w`}
              sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
              alt={t(`items.${promo.key}.alt`)}
              loading="lazy"
              decoding="async"
              className="aspect-[43/24] w-full object-cover"
            />
            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{t(`items.${promo.key}.title`)}</h3>
                <p className="text-sm leading-relaxed text-steel-300">
                  {t(`items.${promo.key}.text`)}
                </p>
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs text-steel-400">
                <CalendarClockIcon className="size-3.5" />
                {t('until')}
              </p>
              <div className="mt-auto space-y-3">
                <PromoCodeCopy code={promo.code} />
                <Link
                  href={promo.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-bright hover:underline"
                >
                  {t(`items.${promo.key}.cta`)}
                  <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </Reveal>
    </section>
  );
}
