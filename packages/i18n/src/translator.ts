import { createTranslator } from 'use-intl/core';
import { timeZone, type Locale } from './config';
import { messages } from './messages';

/**
 * Переводчик вне React: письма, SMS, PDF, AI и MCP. Те же словари и ICU, что и на сайте;
 * ключи типизированы полным путём: t('sms.orderPaid', { number }).
 */
export function getTranslator(locale: Locale) {
  return createTranslator({ locale, messages: messages[locale], timeZone });
}

export type Translator = ReturnType<typeof getTranslator>;
