import type { Locale } from '@redcore/i18n';
import { getMessages } from '@redcore/i18n/messages';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageIntro } from '@/features/about/page-intro';
import { TextBody } from '@/features/help/text-body';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';

// Юридические страницы: публичная оферта и политика конфиденциальности.
// Тексты — about.legalPage.<doc>.*; адрес страницы совпадает с ключом документа.

export type LegalDoc = 'offer' | 'privacy';
type Section = { title: string; body: string };

const other: Record<LegalDoc, LegalDoc> = { offer: 'privacy', privacy: 'offer' };

export async function legalMetadata(locale: Locale, doc: LegalDoc): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'about.legalPage' });
  return {
    title: t(`${doc}.title`),
    description: t(`${doc}.description`),
    alternates: localizedAlternates(locale, `/${doc}`),
  };
}

export async function LegalDocument({ locale, doc }: { locale: Locale; doc: LegalDoc }) {
  const t = await getTranslations({ locale, namespace: 'about.legalPage' });
  const sections = Object.values(getMessages(locale).about.legalPage[doc].sections) as Section[];

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <PageIntro title={t(`${doc}.title`)} />
      <article className="space-y-8" data-testid={`legal-${doc}`}>
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <TextBody text={section.body} />
          </section>
        ))}
      </article>
      <footer className="border-t border-graphite-800 pt-6 text-sm">
        <p className="text-steel-300">
          {t('seeAlso')}:{' '}
          <Link
            href={`/${other[doc]}`}
            className="inline-flex items-center gap-1 text-brand-bright hover:underline"
          >
            {t(`${other[doc]}.title`)}
            <ArrowRightIcon className="size-4" />
          </Link>
        </p>
      </footer>
    </div>
  );
}
