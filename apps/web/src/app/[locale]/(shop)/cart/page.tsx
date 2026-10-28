import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CartView } from '@/features/cart/cart-view';

export async function generateMetadata({ params }: PageProps<'/[locale]/cart'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('title'), robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<'/[locale]/cart'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'cart' });
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      <CartView />
    </div>
  );
}
