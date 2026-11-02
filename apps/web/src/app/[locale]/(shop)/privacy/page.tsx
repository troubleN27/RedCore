import { isLocale, locales } from '@redcore/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument, legalMetadata, type LegalDoc } from '@/features/about/legal-document';

const DOC: LegalDoc = 'privacy';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? legalMetadata(locale, DOC) : {};
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalDocument locale={locale} doc={DOC} />;
}
