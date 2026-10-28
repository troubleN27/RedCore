import type { LlmUsage } from './types';

/**
 * Цены за 1M токенов, USD (план, §8; с 01.01.2027 у 3.8 Flash и с 01.12.2026 у Argon —
 * дороже: обновить таблицу). Неизвестная модель считается по цене chat-модели.
 */
const PRICES: Record<string, { input: number; output: number; cached: number }> = {
  'gemini-3.8-flash': { input: 0.75, output: 3.75, cached: 0.19 },
  'gemini-3.6-flash': { input: 0.5, output: 2.5, cached: 0.13 },
  'gemini-3.5-flash-lite': { input: 0.1, output: 0.4, cached: 0.025 },
  'gemini-4-argon': { input: 2.5, output: 15, cached: 0.63 },
};

/** Стоимость в микродолларах (целое — для суммирования в БД без ошибок округления). */
export function costMicros(model: string | null, usage: LlmUsage): number {
  if (!model) return 0;
  const price = PRICES[model] ?? PRICES['gemini-3.8-flash']!;
  const fresh = Math.max(0, usage.input - usage.cached);
  const usd =
    (fresh * price.input +
      usage.cached * price.cached +
      (usage.output + usage.thought) * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000);
}
