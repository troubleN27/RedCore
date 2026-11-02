import { isLocale, locales } from '@redcore/i18n';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  ClockIcon,
  CpuIcon,
  GaugeIcon,
  HandshakeIcon,
  MapPinIcon,
  PhoneIcon,
  SendIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShowroomPhoto } from '@/features/about/showroom-photo';
import { Stats } from '@/features/about/stats';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';
import { Reveal } from '@/components/motion/reveal';

// Страница «О компании» — тексты в about.page.*

const historyKeys = ['y2019', 'y2021', 'y2024', 'y2026'] as const;
const services: { key: 'parts' | 'assembly' | 'warranty' | 'delivery'; icon: LucideIcon }[] = [
  { key: 'parts', icon: CpuIcon },
  { key: 'assembly', icon: WrenchIcon },
  { key: 'warranty', icon: ShieldCheckIcon },
  { key: 'delivery', icon: TruckIcon },
];
const values: { key: 'prices' | 'compat' | 'test' | 'support'; icon: LucideIcon }[] = [
  { key: 'prices', icon: TagIcon },
  { key: 'compat', icon: BadgeCheckIcon },
  { key: 'test', icon: GaugeIcon },
  { key: 'support', icon: HandshakeIcon },
];
const teamKeys = ['founder', 'builder', 'consultant', 'support'] as const;
const contacts: {
  key: 'address' | 'hours' | 'phone' | 'telegram';
  value: 'addressValue' | 'hoursValue' | 'phoneValue' | 'telegramValue';
  icon: LucideIcon;
}[] = [
  { key: 'address', value: 'addressValue', icon: MapPinIcon },
  { key: 'hours', value: 'hoursValue', icon: ClockIcon },
  { key: 'phone', value: 'phoneValue', icon: PhoneIcon },
  { key: 'telegram', value: 'telegramValue', icon: SendIcon },
];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'about.page' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: localizedAlternates(locale, '/about'),
  };
}

const sectionTitle = 'font-display text-2xl font-bold tracking-tight sm:text-3xl';
const card = 'rounded-xl border border-graphite-800 bg-graphite-900 p-6 shadow-panel';
const iconBox =
  'inline-flex size-11 items-center justify-center rounded-lg border border-brand/30 bg-brand-deep text-brand-bright';

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'about.page' });
  const tp = await getTranslations({ locale, namespace: 'about.teaser' });
  const initials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('');

  return (
    <div className="mx-auto max-w-7xl space-y-20 px-4 py-10 sm:px-6 lg:px-8">
      <header className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 label-caps text-brand-bright shadow-glow-sm">
            {tp('eyebrow')}
          </p>
          <h1 className="font-display text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
            {t('title')}
          </h1>
          <p className="text-lg leading-relaxed text-pretty text-steel-300">{t('intro')}</p>
        </div>
        <ShowroomPhoto
          alt={tp('photoAlt')}
          sizes="(min-width: 1024px) 680px, calc(100vw - 32px)"
          priority
        />
      </header>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-history">
        <h2 id="about-history" className={sectionTitle}>
          {t('historyTitle')}
        </h2>
        <ol className="grid gap-6 border-l border-graphite-800 pl-6 md:grid-cols-4 md:border-t md:border-l-0 md:pt-6 md:pl-0">
          {historyKeys.map((key) => (
            <li key={key} className="relative space-y-2">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[1.95rem] size-3 rounded-full bg-brand shadow-glow-sm md:-top-[1.95rem] md:left-0"
              />
              <p className="font-display text-2xl font-bold text-brand-bright">
                {t(`history.${key}.year`)}
              </p>
              <h3 className="font-semibold">{t(`history.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-steel-300">{t(`history.${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-numbers">
        <h2 id="about-numbers" className={sectionTitle}>
          {t('numbersTitle')}
        </h2>
        <Stats className="grid-cols-2 md:grid-cols-4" />
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-services">
        <h2 id="about-services" className={sectionTitle}>
          {t('servicesTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ key, icon: Icon }) => (
            <article key={key} className={card}>
              <span className={iconBox}>
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{t(`services.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-steel-300">
                {t(`services.${key}.text`)}
              </p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-values">
        <h2 id="about-values" className={sectionTitle}>
          {t('valuesTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map(({ key, icon: Icon }) => (
            <article key={key} className={`${card} flex gap-4`}>
              <span className={`${iconBox} shrink-0`}>
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{t(`values.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-steel-300">
                  {t(`values.${key}.text`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-team">
        <h2 id="about-team" className={sectionTitle}>
          {t('teamTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teamKeys.map((key) => (
            <li key={key} className={`${card} flex items-center gap-4`}>
              <span
                aria-hidden="true"
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-cta font-display text-lg font-bold text-white shadow-glow-sm"
              >
                {initials(t(`team.${key}.name`))}
              </span>
              <div>
                <p className="font-semibold">{t(`team.${key}.name`)}</p>
                <p className="text-sm text-steel-300">{t(`team.${key}.role`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="about-contacts">
        <h2 id="about-contacts" className={sectionTitle}>
          {t('contactsTitle')}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contacts.map(({ key, value, icon: Icon }) => (
            <div key={key} className={`${card} flex flex-col gap-3`}>
              {/* Иконка внутри dt: в dl между dt/dd других элементов быть не может */}
              <dt className="flex flex-col items-start gap-3 label-caps text-steel-400">
                <span className={iconBox}>
                  <Icon className="size-5" />
                </span>
                {t(key)}
              </dt>
              <dd className="text-sm text-foreground">{t(value)}</dd>
            </div>
          ))}
        </dl>
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
