import { isLocale, locales } from '@redcore/i18n';
import { getMessages } from '@redcore/i18n/messages';
import { ChevronDownIcon, HeadsetIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageIntro } from '@/features/about/page-intro';
import { OpenChatButton } from '@/features/chat/open-chat-button';
import { Link } from '@/i18n/navigation';
import { jsonLdScript, localizedAlternates } from '@/lib/seo';
import { Reveal } from '@/components/motion/reveal';

// FAQ — тексты в about.faqPage.*; ответы раскрываются без JS (<details>),
// для поисковиков — разметка FAQPage.

type Item = { q: string; a: string };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/faq'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'about.faqPage' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: localizedAlternates(locale, '/faq'),
  };
}

export default async function FaqPage({ params }: PageProps<'/[locale]/faq'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'about.faqPage' });
  const groups = Object.entries(getMessages(locale).about.faqPage.groups).map(([key, group]) => ({
    key,
    title: group.title,
    items: Object.values(group.items) as Item[],
  }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    ),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <PageIntro title={t('title')} intro={t('intro')} />

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('title')} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {groups.map((group) => (
              <li key={group.key}>
                <a
                  href={`#faq-${group.key}`}
                  className="block rounded-md px-3 py-1.5 text-sm text-steel-300 transition-colors hover:bg-graphite-900 hover:text-white"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          {groups.map((group) => (
            <Reveal
              as="section"
              stagger
              key={group.key}
              id={`faq-${group.key}`}
              className="scroll-mt-24 space-y-4"
              aria-labelledby={`faq-${group.key}-title`}
            >
              <h2
                id={`faq-${group.key}-title`}
                className="font-display text-2xl font-bold tracking-tight"
              >
                {group.title}
              </h2>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-xl border border-graphite-800 bg-graphite-900 shadow-panel transition-colors open:border-brand/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold transition-colors hover:text-brand-bright [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDownIcon className="size-5 shrink-0 text-brand-bright transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-steel-300">{item.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          ))}

          <Reveal
            as="section"
            stagger
            className="relative overflow-hidden rounded-xl border border-brand/30 bg-graphite-900 p-6 shadow-panel"
            aria-labelledby="faq-more"
          >
            <div aria-hidden="true" className="absolute inset-0 bg-hero-glow opacity-50" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand-deep text-brand-bright">
                  <HeadsetIcon className="size-5" />
                </span>
                <div>
                  <h2 id="faq-more" className="font-semibold">
                    {t('moreTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-steel-300">{t('moreText')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <OpenChatButton>{t('chatButton')}</OpenChatButton>
                <Link href="/contacts" className="text-sm text-brand-bright hover:underline">
                  {t('contactsLink')}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
