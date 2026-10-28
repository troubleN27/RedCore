import { isLocale } from '@redcore/i18n';
import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import credits from '@/generated/credits.json';
import { localizedAlternates } from '@/lib/seo';

// Атрибуция CC BY: список генерирует `pnpm assets:report` из манифеста собранных моделей.

interface Credit {
  kind: 'model' | 'font' | 'data';
  title: string;
  author: string;
  license: string;
  url: string;
  changes: string;
}

const KINDS = ['model', 'font', 'data'] as const;
const sectionKey = { model: 'models', font: 'fonts', data: 'data' } as const;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/credits'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'credits' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/credits'),
  };
}

export default async function CreditsPage({ params }: PageProps<'/[locale]/credits'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'credits' });
  const list = credits as Credit[];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <p className="text-steel-300">{t('subtitle')}</p>
      </header>
      {KINDS.map((kind) => {
        const items = list.filter((c) => c.kind === kind);
        return (
          <section key={kind} className="space-y-3" data-testid={`credits-${kind}`}>
            <h2 className="text-lg font-semibold">{t(sectionKey[kind])}</h2>
            {items.length === 0 && kind === 'model' && (
              <p className="text-sm text-steel-400">{t('noModels')}</p>
            )}
            <ul className="space-y-3">
              {items.map((c) => (
                <li
                  key={c.url + c.title}
                  className="space-y-1 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 text-sm"
                >
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium hover:underline"
                  >
                    {c.title}
                    <ExternalLinkIcon className="size-3.5 text-steel-400" />
                  </a>
                  <p className="text-steel-300">{t('author', { author: c.author })}</p>
                  <p className="text-steel-300">{t('license', { license: c.license })}</p>
                  <p className="text-xs text-steel-400">{t('changes', { changes: c.changes })}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-sm text-steel-400">{t('procedural')}</p>
    </div>
  );
}
