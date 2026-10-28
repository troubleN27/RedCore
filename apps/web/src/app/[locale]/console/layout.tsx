import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConsoleBaseProvider } from '@/features/console/console-base';
import { assertConsoleRequest } from '@/server/staff';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]/console'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'console.meta' });
  return {
    title: { absolute: t('title') },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function ConsoleRootLayout({
  children,
  params,
}: LayoutProps<'/[locale]/console'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const base = await assertConsoleRequest();
  return (
    <ConsoleBaseProvider base={base}>
      <div id="main" className="min-h-dvh bg-background">
        {children}
      </div>
    </ConsoleBaseProvider>
  );
}
