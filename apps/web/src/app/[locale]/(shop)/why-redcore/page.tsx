import { isLocale, locales } from '@redcore/i18n';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  GaugeIcon,
  HandshakeIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageIntro } from '@/features/about/page-intro';
import { Stats } from '@/features/about/stats';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';
import { Reveal } from '@/components/motion/reveal';

// Страница «Почему REDCORE» — тексты в about.whyPage.*

const reasons: {
  key: 'compat' | 'test' | 'warranty' | 'prices' | 'delivery' | 'support';
  icon: LucideIcon;
}[] = [
  { key: 'compat', icon: BadgeCheckIcon },
  { key: 'test', icon: GaugeIcon },
  { key: 'warranty', icon: ShieldCheckIcon },
  { key: 'prices', icon: TagIcon },
  { key: 'delivery', icon: TruckIcon },
  { key: 'support', icon: HandshakeIcon },
];
const steps = ['s1', 's2', 's3', 's4', 's5'] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/why-redcore'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'about.whyPage' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: localizedAlternates(locale, '/why-redcore'),
  };
}

const sectionTitle = 'font-display text-2xl font-bold tracking-tight sm:text-3xl';

export default async function WhyPage({ params }: PageProps<'/[locale]/why-redcore'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'about.whyPage' });

  return (
    <div className="mx-auto max-w-7xl space-y-20 px-4 py-10 sm:px-6 lg:px-8">
      <PageIntro title={t('title')} intro={t('intro')} />

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="why-reasons">
        <h2 id="why-reasons" className={sectionTitle}>
          {t('reasonsTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="group relative overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-6 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow-lg"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
              />
              <span className="inline-flex size-11 items-center justify-center rounded-lg border border-brand/30 bg-brand-deep text-brand-bright">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{t(`reasons.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-steel-300">
                {t(`reasons.${key}.text`)}
              </p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="why-steps">
        <h2 id="why-steps" className={sectionTitle}>
          {t('stepsTitle')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map((key, i) => (
            <li
              key={key}
              className="relative rounded-xl border border-graphite-800 bg-graphite-900 p-5 shadow-panel"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-9 items-center justify-center rounded-full bg-cta font-display text-sm font-bold text-white shadow-glow-sm"
              >
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{t(`steps.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-steel-300">
                {t(`steps.${key}.text`)}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="why-numbers">
        <h2 id="why-numbers" className={sectionTitle}>
          {t('numbersTitle')}
        </h2>
        <Stats className="grid-cols-2 md:grid-cols-4" />
      </Reveal>

      <Reveal
        as="section"
        stagger
        className="relative overflow-hidden rounded-2xl border border-brand/30 bg-graphite-900 p-8 text-center shadow-panel sm:p-12"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-hero-glow opacity-60" />
        <div className="relative space-y-5">
          <h2 className={sectionTitle}>{t('ctaTitle')}</h2>
          <p className="mx-auto max-w-xl text-steel-300">{t('ctaText')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/configurator">
                {t('ctaConfigurator')}
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/catalog">{t('ctaCatalog')}</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
