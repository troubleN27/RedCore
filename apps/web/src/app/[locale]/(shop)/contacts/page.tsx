import { isLocale, locales } from '@redcore/i18n';
import {
  ClockIcon,
  HeadsetIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  SendIcon,
  ShoppingBagIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageIntro } from '@/features/about/page-intro';
import { ShowroomPhoto } from '@/features/about/showroom-photo';
import { OpenChatButton } from '@/features/chat/open-chat-button';
import { localizedAlternates } from '@/lib/seo';
import { Reveal } from '@/components/motion/reveal';

// Страница «Контакты» — тексты в about.contactsPage.*
// (адрес и часы шоурума — общие со страницей «О компании», about.page.*)

const showroom: {
  key: 'address' | 'hours' | 'phone' | 'telegram';
  value: 'addressValue' | 'hoursValue' | 'phoneValue' | 'telegramValue';
  icon: LucideIcon;
}[] = [
  { key: 'address', value: 'addressValue', icon: MapPinIcon },
  { key: 'hours', value: 'hoursValue', icon: ClockIcon },
  { key: 'phone', value: 'phoneValue', icon: PhoneIcon },
  { key: 'telegram', value: 'telegramValue', icon: SendIcon },
];
const departments: { key: 'sales' | 'service' | 'orders'; icon: LucideIcon }[] = [
  { key: 'sales', icon: ShoppingBagIcon },
  { key: 'service', icon: WrenchIcon },
  { key: 'orders', icon: PackageIcon },
];
const requisites = ['company', 'address'] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contacts'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'about.contactsPage' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: localizedAlternates(locale, '/contacts'),
  };
}

const sectionTitle = 'font-display text-2xl font-bold tracking-tight sm:text-3xl';
const card = 'rounded-xl border border-graphite-800 bg-graphite-900 p-6 shadow-panel';
const iconBox =
  'inline-flex size-11 items-center justify-center rounded-lg border border-brand/30 bg-brand-deep text-brand-bright';

export default async function ContactsPage({ params }: PageProps<'/[locale]/contacts'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'about.contactsPage' });
  const tp = await getTranslations({ locale, namespace: 'about.page' });
  const tt = await getTranslations({ locale, namespace: 'about.teaser' });

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 lg:px-8">
      <PageIntro title={t('title')} intro={t('intro')} />

      <Reveal
        as="section"
        stagger
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[1fr_1.1fr]"
        aria-labelledby="contacts-showroom"
      >
        <div className="space-y-6">
          <h2 id="contacts-showroom" className={sectionTitle}>
            {t('mainTitle')}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {showroom.map(({ key, value, icon: Icon }) => (
              <div key={key} className={`${card} flex flex-col gap-2`}>
                {/* Иконка внутри dt: в dl между dt/dd других элементов быть не может */}
                <dt className="flex flex-col items-start gap-3 label-caps text-steel-400">
                  <span className={iconBox}>
                    <Icon className="size-5" />
                  </span>
                  {tp(key)}
                </dt>
                <dd className="text-sm text-foreground">{tp(value)}</dd>
              </div>
            ))}
          </dl>
          <div className={card}>
            <h3 className="font-semibold">{t('routeTitle')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-steel-300">{t('route')}</p>
          </div>
        </div>
        <ShowroomPhoto
          alt={tt('photoAlt')}
          sizes="(min-width: 1024px) 640px, calc(100vw - 32px)"
          className="lg:mt-14"
        />
      </Reveal>

      <Reveal as="section" stagger className="space-y-8" aria-labelledby="contacts-departments">
        <h2 id="contacts-departments" className={sectionTitle}>
          {t('departmentsTitle')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {departments.map(({ key, icon: Icon }) => (
            <article key={key} className={card}>
              <span className={iconBox}>
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{t(`departments.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-steel-300">
                {t(`departments.${key}.text`)}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-foreground">
                <PhoneIcon className="size-4 text-brand-bright" />
                {t(`departments.${key}.phone`)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-steel-300">
                <ClockIcon className="size-4 text-brand-bright" />
                {t(`departments.${key}.hours`)}
              </p>
            </article>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2">
        <Reveal as="section" stagger className={card} aria-labelledby="contacts-requisites">
          <h2 id="contacts-requisites" className="font-semibold">
            {t('requisitesTitle')}
          </h2>
          <ul className="mt-3 space-y-1.5 font-mono text-sm text-steel-300">
            {requisites.map((key) => (
              <li key={key}>{t(`requisites.${key}`)}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal
          as="section"
          stagger
          className="relative overflow-hidden rounded-xl border border-brand/30 bg-graphite-900 p-6 shadow-panel"
          aria-labelledby="contacts-chat"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-hero-glow opacity-50" />
          <div className="relative space-y-3">
            <span className={iconBox}>
              <HeadsetIcon className="size-5" />
            </span>
            <h2 id="contacts-chat" className="font-semibold">
              {t('chatTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-steel-300">{t('chatText')}</p>
            <OpenChatButton>{t('chatButton')}</OpenChatButton>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
