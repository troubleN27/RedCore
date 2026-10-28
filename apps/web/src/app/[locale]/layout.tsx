import { htmlLangs } from '@redcore/i18n';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/footer';
import { AccountSync } from '@/features/account/account-sync';
import { Header } from '@/components/layout/header';
import { SiteChrome } from '@/components/layout/site-chrome';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { env } from '@/env';
import { routing } from '@/i18n/routing';
import { fontVariables } from '@/lib/fonts';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: t('title'), template: t('titleTemplate') },
    description: t('description'),
    applicationName: 'RedCore',
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
        'x-default': `/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'RedCore',
      locale: locale === 'uz' ? 'uz_UZ' : 'ru_RU',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'nav' });

  return (
    <html lang={htmlLangs[locale]} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <TooltipProvider delayDuration={200}>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              {t('skipToContent')}
            </a>
            <SiteChrome header={<Header />} footer={<Footer />}>
              {children}
            </SiteChrome>
            <Toaster position="bottom-right" />
            <AccountSync />
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
