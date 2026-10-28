/** Курс ЦБ РУз на 27.10.2026 (11 861,96 сум за доллар). Переопределяется SEED_USD_UZS_RATE. */
export const DEFAULT_USD_UZS_RATE = 11_862;

/** Розничная наценка к цене в долларах: доставка, таможня, гарантия, маржа. */
export const RETAIL_MARKUP = 1.15;

export function seedRate(): number {
  const fromEnv = Number(process.env.SEED_USD_UZS_RATE);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_USD_UZS_RATE;
}

/** Розничная цена в сумах, округлённая вверх до 10 000. */
export function usdToUzs(usd: number, rate: number): number {
  return Math.ceil((usd * rate * RETAIL_MARKUP) / 10_000) * 10_000;
}

/** Цена готовой сборки: компоненты со скидкой 3% плюс сборка, округление до 10 000. */
export function prebuiltPriceUzs(componentsUzs: number, assemblyUzs: number): number {
  return Math.ceil((componentsUzs * 0.97 + assemblyUzs) / 10_000) * 10_000;
}

/** Детерминированный остаток от slug: 2–24 шт. — seed воспроизводим между запусками. */
export function stockFor(slug: string): number {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 2 + (hash % 23);
}
