/** Сумма в узбекских сумах: целое число, без тийинов. В БД — bigint. */
export type Uzs = number;

export function isUzs(value: unknown): value is Uzs {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertUzs(value: number, label = 'amount'): asserts value is Uzs {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer amount of UZS, got ${value}`);
  }
}

export function sumUzs(values: readonly Uzs[]): Uzs {
  let total = 0;
  for (const value of values) {
    assertUzs(value);
    total += value;
  }
  assertUzs(total, 'sum');
  return total;
}

/**
 * Раскладывает целую сумму по целым весам методом наибольшего остатка:
 * части всегда в сумме дают исходное значение. Нужно, чтобы распределить
 * скидку промокода по позициям заказа и получить в Stripe ровно тот же итог.
 * Считается в BigInt — без потерь точности на больших суммах.
 */
export function allocateByWeights(total: Uzs, weights: readonly number[]): Uzs[] {
  assertUzs(total, 'total');
  if (weights.length === 0) throw new RangeError('weights must not be empty');
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new RangeError(`weights must be non-negative safe integers, got ${weight}`);
    }
  }

  const bigWeights = weights.map((weight) => BigInt(weight));
  const weightSum = bigWeights.reduce((acc, weight) => acc + weight, 0n);
  if (weightSum === 0n) throw new RangeError('at least one weight must be positive');

  const sign = total < 0 ? -1n : 1n;
  const absTotal = BigInt(Math.abs(total));
  const shares = bigWeights.map((weight) => (absTotal * weight) / weightSum);
  const remainders = bigWeights.map((weight) => (absTotal * weight) % weightSum);

  let leftover = absTotal - shares.reduce((acc, share) => acc + share, 0n);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
  for (const { index } of order) {
    if (leftover === 0n) break;
    shares[index] = (shares[index] ?? 0n) + 1n;
    leftover -= 1n;
  }

  return shares.map((share) => Number(share * sign));
}
