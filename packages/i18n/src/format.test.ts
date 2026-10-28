import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber, formatPrice, groupDigits } from './format';

const NBSP = '\u00A0';

describe('groupDigits', () => {
  it('группирует разряды неразрывными пробелами', () => {
    expect(groupDigits(12450000)).toBe(`12${NBSP}450${NBSP}000`);
    expect(groupDigits(999)).toBe('999');
    expect(groupDigits(1000)).toBe(`1${NBSP}000`);
    expect(groupDigits(0)).toBe('0');
  });

  it('округляет до целых — в сумах нет копеек', () => {
    expect(groupDigits(1499.6)).toBe(`1${NBSP}500`);
  });

  it('ставит типографский минус для отрицательных сумм', () => {
    expect(groupDigits(-250000)).toBe(`\u2212250${NBSP}000`);
  });

  it('не принимает NaN и бесконечность', () => {
    expect(() => groupDigits(Number.NaN)).toThrow(RangeError);
    expect(() => groupDigits(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatPrice', () => {
  it('ru: «12 450 000 сум»', () => {
    expect(formatPrice(12450000, 'ru')).toBe(`12${NBSP}450${NBSP}000${NBSP}сум`);
  });

  it('uz: «12 450 000 soʻm» с U+02BB', () => {
    expect(formatPrice(12450000, 'uz')).toBe(`12${NBSP}450${NBSP}000${NBSP}soʻm`);
  });

  it('держит суммы больше int32 (крупные B2B-заказы)', () => {
    expect(formatPrice(3_250_000_000, 'ru')).toBe(`3${NBSP}250${NBSP}000${NBSP}000${NBSP}сум`);
  });
});

describe('formatNumber', () => {
  it('использует неразрывный пробел для групп на обоих языках', () => {
    expect(formatNumber(3600, 'ru')).toBe(`3${NBSP}600`);
    expect(formatNumber(3600, 'uz')).toBe(`3${NBSP}600`);
  });
});

describe('formatDate', () => {
  it('форматирует в часовом поясе Ташкента', () => {
    // 2026-10-27T20:30Z — в Ташкенте (UTC+5) уже 28 октября
    const iso = '2026-10-27T20:30:00Z';
    expect(formatDate(iso, 'ru')).toContain('28');
    expect(formatDate(iso, 'ru')).toContain('2026');
  });
});
