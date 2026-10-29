import { getDb } from '@redcore/db';
import { formatPrice, isLocale, locales } from '@redcore/i18n';
import { getMessages } from '@redcore/i18n/messages';
import { loadZones } from '@redcore/services';
import { InfoIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';
import { cn } from '@/lib/utils';

// Страницы для покупателей: доставка, оплата, гарантия, возврат. Тексты — policies.* (их же
// краткие версии читают AI-поддержка и MCP), зоны доставки — из базы.

const TOPICS = ['delivery', 'payment', 'warranty', 'returns'] as const;
type Topic = (typeof TOPICS)[number];
type Section = { title: string; body: string };

// Зоны правят в консоли редко — страница пересобирается раз в час
export const revalidate = 3600;

export function generateStaticParams() {
  return locales.flatMap((locale) => TOPICS.map((topic) => ({ locale, topic })));
}

const isTopic = (value: string): value is Topic => (TOPICS as readonly string[]).includes(value);

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/help/[topic]'>): Promise<Metadata> {
  const { locale, topic } = await params;
  if (!isLocale(locale) || !isTopic(topic)) return {};
  const t = await getTranslations({ locale, namespace: 'policies' });
  return {
    title: t(`${topic}.title`),
    description: t(`${topic}.intro`),
    alternates: localizedAlternates(locale, `/help/${topic}`),
  };
}

/** Абзацы через перевод строки; строки с «— » — пункты списка. */
function Body({ text }: { text: string }) {
  const lines = text.split('\n');
  const items = lines.filter((line) => line.startsWith('— '));
  if (items.length === lines.length) {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-steel-300">
        {items.map((line) => (
          <li key={line}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2 text-steel-300">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

async function Zones({ locale }: { locale: 'ru' | 'uz' }) {
  const t = await getTranslations({ locale, namespace: 'policies.page' });
  const zones = await loadZones(await getDb(), locale);
  const eta = (min: number, max: number) =>
    min === max ? t('etaSame', { days: min }) : t('etaDays', { min, max });
  return (
    <section className="space-y-3" data-testid="delivery-zones">
      <h2 className="text-lg font-semibold">{t('zonesTitle')}</h2>
      <div className="overflow-x-auto rounded-xl border border-graphite-800">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-graphite-900 text-left text-xs text-steel-400">
            <tr>
              <th className="px-3 py-2 font-medium">{t('zone')}</th>
              <th className="px-3 py-2 font-medium">{t('price')}</th>
              <th className="px-3 py-2 font-medium">{t('freeFrom')}</th>
              <th className="px-3 py-2 font-medium">{t('eta')}</th>
              <th className="px-3 py-2 font-medium">{t('cod')}</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.code} className="border-t border-graphite-800">
                <td className="px-3 py-2">{z.name}</td>
                <td className="px-3 py-2 tabular-nums">
                  {z.priceUzs === 0 ? t('free') : formatPrice(z.priceUzs, locale)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {z.freeFromUzs ? formatPrice(z.freeFromUzs, locale) : t('dash')}
                </td>
                <td className="px-3 py-2">{eta(z.etaMinDays, z.etaMaxDays)}</td>
                <td className="px-3 py-2">{z.codAllowed ? t('yes') : t('no')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function HelpPage({ params }: PageProps<'/[locale]/help/[topic]'>) {
  const { locale, topic } = await params;
  if (!isLocale(locale) || !isTopic(topic)) notFound();
  const t = await getTranslations({ locale, namespace: 'policies' });
  const sections: Section[] = Object.values(getMessages(locale).policies[topic].sections);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8">
      <nav aria-label={t('page.nav')} className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 label-caps text-steel-400">{t('page.nav')}</p>
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {TOPICS.map((item) => (
            <li key={item}>
              <Link
                href={`/help/${item}`}
                aria-current={item === topic ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-3 py-1.5 text-sm transition-colors',
                  item === topic
                    ? 'bg-graphite-800 font-semibold text-white'
                    : 'text-steel-300 hover:bg-graphite-900 hover:text-white',
                )}
              >
                {t(`${item}.title`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className="space-y-8" data-testid={`help-${topic}`}>
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">{t(`${topic}.title`)}</h1>
          <p className="text-lg text-steel-300">{t(`${topic}.intro`)}</p>
          <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-steel-300">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
            {t('page.demo')}
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <Body text={section.body} />
          </section>
        ))}

        {topic === 'delivery' && <Zones locale={locale} />}

        <footer className="space-y-1 border-t border-graphite-800 pt-6 text-sm text-steel-400">
          <p>{t('page.contacts')}</p>
          <p className="text-xs">{t('page.updated')}</p>
        </footer>
      </article>
    </div>
  );
}
