import { describe, expect, it } from 'vitest';
import { allocateByWeights, assertUzs, isUzs, sumUzs } from './money';

describe('Uzs', () => {
  it('принимает только целые суммы', () => {
    expect(isUzs(12_450_000)).toBe(true);
    expect(isUzs(12.5)).toBe(false);
    expect(isUzs('100')).toBe(false);
    expect(() => assertUzs(0.5)).toThrow(RangeError);
  });

  it('суммирует позиции', () => {
    expect(sumUzs([8_490_000, 3_250_000, 710_000])).toBe(12_450_000);
    expect(sumUzs([])).toBe(0);
  });
});

describe('allocateByWeights', () => {
  it('части всегда дают исходную сумму', () => {
    const parts = allocateByWeights(100_000, [8_490_000, 3_250_000, 710_000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it('распределяет пропорционально весам', () => {
    expect(allocateByWeights(300, [1, 1, 1])).toEqual([100, 100, 100]);
    expect(allocateByWeights(1_000, [3, 1])).toEqual([750, 250]);
  });

  it('отдаёт остаток позициям с наибольшей дробной частью, при равенстве — первым', () => {
    expect(allocateByWeights(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocateByWeights(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it('сохраняет знак для отрицательных сумм (скидки)', () => {
    const parts = allocateByWeights(-10, [1, 1, 1]);
    expect(parts).toEqual([-4, -3, -3]);
  });

  it('точен на больших суммах', () => {
    const parts = allocateByWeights(9_000_000_000, [99_999_999, 1, 33_333_333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9_000_000_000);
  });

  it('отклоняет некорректные веса', () => {
    expect(() => allocateByWeights(100, [])).toThrow(RangeError);
    expect(() => allocateByWeights(100, [0, 0])).toThrow(RangeError);
    expect(() => allocateByWeights(100, [1.5])).toThrow(RangeError);
    expect(() => allocateByWeights(100, [-1, 2])).toThrow(RangeError);
  });
});
