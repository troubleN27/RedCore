import { timeZone } from '@redcore/i18n';
import { getMessages } from '@redcore/i18n/messages';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { routing } from './routing';

export default getRequestConfig(async ({ locale }) => {
  // Явная локаль приходит из getTranslations({locale}); иначе берём сегмент [locale]
  let resolved = locale;
  if (!resolved) {
    const segment = await rootParams.locale();
    if (!hasLocale(routing.locales, segment)) notFound();
    resolved = segment;
  }

  return {
    locale: resolved,
    messages: getMessages(resolved),
    timeZone,
  };
});
