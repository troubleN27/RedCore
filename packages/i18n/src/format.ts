import { intlLocales, timeZone, type Locale } from './config';

const NBSP = '\u00A0';
const MINUS = '\u2212';
// Intl в разных движках ставит обычный, неразрывный или узкий (U+202F) пробел
const NARROW_OR_REGULAR_SPACE = new RegExp('[\\s\\u202F]', 'g');

/** Подпись валюты. На узбекском — официальная орфография с ʻ (U+02BB). */
export const currencyLabels: Record<Locale, string> = {
  ru: 'сум',
  uz: 'soʻm',
};

/**
 * Группирует разряды неразрывными пробелами: 12450000 → «12 450 000».
 * Дробная часть отбрасывается округлением — в сумах нет копеек.
 */
export function groupDigits(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot format non-finite number: ${value}`);
  }
  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** «12 450 000 сум» / «12 450 000 soʻm». */
export function formatPrice(amountUzs: number, locale: Locale): string {
  return `${groupDigits(amountUzs)}${NBSP}${currencyLabels[locale]}`;
}

/** Число с группировкой разрядов, без валюты (для характеристик: «3 600 МГц»). */
export function formatNumber(value: number, locale: Locale, fractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocales[locale], {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  })
    .format(value)
    .replace(NARROW_OR_REGULAR_SPACE, NBSP);
}

export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { timeZone, ...options }).format(
    new Date(date),
  );
}
