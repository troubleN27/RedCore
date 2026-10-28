import { isLocale } from '@redcore/i18n';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AccountNav } from '@/features/account/account-nav';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/server/auth';

// Зависит от сессии покупателя — только серверный рендер на запрос
export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<'/[locale]/account'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (!session) redirect({ href: '/login?next=/account', locale });
  const t = await getTranslations({ locale, namespace: 'account' });
  const name = session!.user.name.startsWith('+')
    ? session!.user.name
    : session!.user.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-steel-300">{t('greeting', { name: name ?? '' })}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
