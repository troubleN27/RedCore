import type { Locale } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';

// Тексты SMS — из словаря sms.* на языке покупателя.

export function otpSms(locale: Locale, code: string): string {
  return getTranslator(locale)('sms.otp', { code });
}
