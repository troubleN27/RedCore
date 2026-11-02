'use client';

import type { Facet, RangeValue } from '@redcore/services/types';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { useCatalogParams } from './use-catalog-params';

/** Шаг ползунка и округление границ — цены в каталоге кратны 10 000 сум */
const STEP = 10_000;

const roundDown = (n: number) => Math.floor(n / STEP) * STEP;
/** «12450000» → «12 450 000»: в узком поле так читается без обрезки */
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const digits = (text: string) => Number(text.replace(/\D/g, '')) || 0;
const roundUp = (n: number) => Math.ceil(n / STEP) * STEP;

/**
 * Цена «от – до»: два ползунка на одной шкале и поля ввода. Применяется, когда ползунок
 * отпущен или поле потеряло фокус; граница, совпадающая с краем шкалы, в URL не пишется.
 */
export function PriceFilter({ facet, value }: { facet: Facet; value?: RangeValue }) {
  const t = useTranslations('catalog');
  const { update } = useCatalogParams();
  const lo = roundDown(facet.min ?? 0);
  const hi = roundUp(facet.max ?? 0);
  const [min, setMin] = useState(value?.min ?? lo);
  const [max, setMax] = useState(value?.max ?? hi);

  function apply(nextMin = min, nextMax = max) {
    const from = Math.max(lo, Math.min(nextMin, nextMax));
    const to = Math.min(hi, Math.max(nextMin, nextMax));
    setMin(from);
    setMax(to);
    update((params) => {
      if (from <= lo && to >= hi) params.delete(facet.key);
      else params.set(facet.key, `${from > lo ? from : ''}-${to < hi ? to : ''}`);
    });
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    apply();
  };
  const percent = (n: number) => ((n - lo) / Math.max(1, hi - lo)) * 100;
  const thumb =
    'pointer-events-none absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-brand [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-glow-sm';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-graphite-800" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand shadow-glow-sm"
          style={{ left: `${percent(min)}%`, right: `${100 - percent(max)}%` }}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          step={STEP}
          value={min}
          aria-label={t('rangeFrom')}
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          onPointerUp={() => apply()}
          onKeyUp={() => apply()}
          className={thumb}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          step={STEP}
          value={max}
          aria-label={t('rangeTo')}
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          onPointerUp={() => apply()}
          onKeyUp={() => apply()}
          className={thumb}
        />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          aria-label={t('rangeFrom')}
          value={grouped(min)}
          onChange={(e) => setMin(digits(e.target.value))}
          onBlur={() => apply()}
          className="h-8 px-2 text-xs tabular-nums"
        />
        <span aria-hidden="true" className="text-steel-400">
          —
        </span>
        <Input
          type="text"
          inputMode="numeric"
          aria-label={t('rangeTo')}
          value={grouped(max)}
          onChange={(e) => setMax(digits(e.target.value))}
          onBlur={() => apply()}
          className="h-8 px-2 text-xs tabular-nums"
        />
        <button type="submit" className="sr-only">
          {t('apply')}
        </button>
      </div>
    </form>
  );
}
