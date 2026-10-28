import { describe, expect, it } from 'vitest';
import { isLocale, locales } from './config';
import { messages } from './messages';
import { compareMessageTrees, placeholderNames } from './parity';

describe('словари', () => {
  it.each(locales.filter((l) => l !== 'ru'))('%s повторяет структуру ru', (locale) => {
    expect(compareMessageTrees(messages.ru, messages[locale])).toEqual([]);
  });
});

describe('placeholderNames', () => {
  it('находит простые и plural-аргументы', () => {
    expect(placeholderNames('© {year} RedCore')).toEqual(['year']);
    expect(placeholderNames('Осталось {count, plural, one {# штука} other {# штуки}}')).toEqual([
      'count',
    ]);
    expect(placeholderNames('{watts} / {psu} Вт')).toEqual(['psu', 'watts']);
    expect(placeholderNames('без аргументов')).toEqual([]);
  });
});

describe('compareMessageTrees', () => {
  it('ловит пропуски, лишние ключи, пустые строки и расхождение аргументов', () => {
    const reference = { a: 'A', b: { c: '{x} C' }, d: 'D' };
    const translation = { a: '', b: { c: '{y} C' }, e: 'E' };
    const issues = compareMessageTrees(reference, translation).map((p) => `${p.issue}:${p.key}`);
    expect(issues).toEqual(
      expect.arrayContaining(['empty:a', 'placeholders:b.c', 'missing:d', 'extra:e']),
    );
  });
});

describe('isLocale', () => {
  it('принимает только поддерживаемые языки', () => {
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('uz')).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
