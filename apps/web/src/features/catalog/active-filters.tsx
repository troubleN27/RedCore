'use client';

import { formatNumber, formatPrice, isLocale } from '@redcore/i18n';
import type { Facet, FilterSelection, RangeValue } from '@redcore/services/types';
import { XIcon } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { enumLabel, unitLabel } from '../product/spec-format';
import { STOCK_PARAM } from './filters-panel';
import { useCatalogParams } from './use-catalog-params';

interface Chip {
  id: string;
  label: string;
  remove: (params: URLSearchParams) => void;
}

/** Выбранные фильтры над товарами: каждый снимается крестиком, «Сбросить всё» — все сразу. */
export function ActiveFilters({
  facets,
  selection,
  inStockOnly,
  chipNames,
}: {
  facets: Facet[];
  selection: FilterSelection;
  inStockOnly: boolean;
  chipNames: Record<string, string>;
}) {
  const t = useTranslations('catalog');
  const localeRaw = useLocale();
  const locale = isLocale(localeRaw) ? localeRaw : 'ru';
  const dict = useMessages().specs;
  const labels = dict.labels as Record<string, string>;
  const { update, isPending } = useCatalogParams();
  const ctx = { locale, dict, chipNames };

  const rangeText = (facet: Facet, range: RangeValue) => {
    const fmt = (n: number) =>
      facet.key === 'price' ? formatPrice(n, locale) : formatNumber(n, locale, 1);
    const unit = facet.key === 'price' ? '' : unitLabel(facet.unit, dict);
    const from = range.min !== undefined ? `${t('rangeFrom')} ${fmt(range.min)}` : '';
    const to = range.max !== undefined ? `${t('rangeTo')} ${fmt(range.max)}` : '';
    return [from, to].filter(Boolean).join(' ') + (unit ? ` ${unit}` : '');
  };

  const chips: Chip[] = [];
  if (inStockOnly) {
    chips.push({ id: STOCK_PARAM, label: t('inStockOnly'), remove: (p) => p.delete(STOCK_PARAM) });
  }
  for (const facet of facets) {
    const selected = selection[facet.key];
    if (!selected) continue;
    const title = labels[facet.key] ?? facet.key;
    if (selected === true) {
      chips.push({ id: facet.key, label: title, remove: (p) => p.delete(facet.key) });
    } else if (Array.isArray(selected)) {
      for (const value of selected) {
        chips.push({
          id: `${facet.key}:${value}`,
          label: enumLabel(facet.key, value, ctx),
          remove: (p) => {
            const rest = selected.filter((v) => v !== value);
            if (rest.length > 0) p.set(facet.key, rest.join(','));
            else p.delete(facet.key);
          },
        });
      }
    } else {
      chips.push({
        id: facet.key,
        label: t('rangeChip', { label: title, range: rangeText(facet, selected) }),
        remove: (p) => p.delete(facet.key),
      });
    }
  }
  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={t('activeFilters')}
      aria-busy={isPending}
      role="group"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => update(chip.remove)}
          aria-label={t('removeFilter', { label: chip.label })}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 py-1 pr-2 pl-3 text-xs font-medium text-foreground transition-colors hover:border-brand hover:bg-brand/20"
        >
          {chip.label}
          <XIcon className="size-3.5 text-brand-bright" />
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          update((p) => {
            for (const facet of facets) p.delete(facet.key);
            p.delete(STOCK_PARAM);
          })
        }
        className="px-2 text-xs font-medium text-steel-400 hover:text-foreground hover:underline"
      >
        {t('resetAll')}
      </button>
    </div>
  );
}
