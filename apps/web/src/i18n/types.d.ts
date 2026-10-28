import type { Locale } from '@redcore/i18n';
import type { Messages } from '@redcore/i18n/messages';

// Типобезопасные ключи: t('home.hero.title') проверяется компилятором.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
