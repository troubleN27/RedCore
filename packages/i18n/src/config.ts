export const locales = ['ru', 'uz'] as const;

export type Locale = (typeof locales)[number];

/** Язык по умолчанию, если браузер не прислал ни ru, ни uz. */
export const defaultLocale: Locale = 'ru';

/** Название языка на нём самом — так его показывает переключатель. */
export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  uz: 'Oʻzbekcha',
};

/** Короткая подпись для компактного переключателя в шапке. */
export const localeShortNames: Record<Locale, string> = {
  ru: 'RU',
  uz: 'UZ',
};

/** BCP-47 для Intl и атрибута lang: узбекский — латиница. */
export const intlLocales: Record<Locale, string> = {
  ru: 'ru-RU',
  uz: 'uz-Latn-UZ',
};

export const htmlLangs: Record<Locale, string> = {
  ru: 'ru',
  uz: 'uz-Latn',
};

export const timeZone = 'Asia/Tashkent';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
