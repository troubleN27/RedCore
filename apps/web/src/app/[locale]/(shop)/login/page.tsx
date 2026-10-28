import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LoginForm } from '@/features/account/login-form';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/server/auth';

// Зависит от сессии покупателя — только серверный рендер на запрос
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('title'), robots: { index: false } };
}

/** Только внутренние пути: внешний ?next= — классическая уязвимость open redirect. */
function safeNext(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect({ href: next, locale });
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="space-y-6 rounded-2xl border border-white/10 bg-graphite-950/80 p-6 shadow-panel sm:p-8">
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-steel-300">{t('subtitle')}</p>
        </header>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
