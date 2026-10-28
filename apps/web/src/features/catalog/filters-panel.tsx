'use client';

import type { Facet, FilterSelection, RangeValue } from '@redcore/services/types';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { enumLabel, unitLabel } from '../product/spec-format';
import { useCatalogParams } from './use-catalog-params';

interface FiltersPanelProps {
  facets: Facet[];
  selection: FilterSelection;
  inStockOnly: boolean;
  chipNames: Record<string, string>;
  total: number;
  className?: string;
}

/** URL-параметр «только в наличии» */
const STOCK_PARAM = 'stock';

const rangeKey = (selected: FilterSelection[string] | undefined) =>
  selected && !Array.isArray(selected) && selected !== true
    ? `${selected.min ?? ''}-${selected.max ?? ''}`
    : '';

function RangeFilter({ facet, value, unit }: { facet: Facet; value?: RangeValue; unit: string }) {
  const t = useTranslations('catalog');
  const { update } = useCatalogParams();
  const [min, setMin] = useState(value?.min?.toString() ?? '');
  const [max, setMax] = useState(value?.max?.toString() ?? '');

  function apply(event: FormEvent) {
    event.preventDefault();
    update((params) => {
      if (min === '' && max === '') params.delete(facet.key);
      else params.set(facet.key, `${min}-${max}`);
    });
  }

  return (
    <form onSubmit={apply} className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        aria-label={`${t('rangeFrom')} ${unit}`}
        placeholder={`${t('rangeFrom')} ${facet.min}`}
        value={min}
        onChange={(e) => setMin(e.target.value)}
        onBlur={apply}
        className="h-8 text-xs"
      />
      <span aria-hidden="true" className="text-steel-400">
        —
      </span>
      <Input
        type="number"
        inputMode="decimal"
        aria-label={`${t('rangeTo')} ${unit}`}
        placeholder={`${t('rangeTo')} ${facet.max}`}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        onBlur={apply}
        className="h-8 text-xs"
      />
      <button type="submit" className="sr-only">
        {t('apply')}
      </button>
    </form>
  );
}

/** Фасетные фильтры категории. Состояние живёт в URL — ссылкой можно поделиться. */
export function FiltersPanel({
  facets,
  selection,
  inStockOnly,
  chipNames,
  total,
  className,
}: FiltersPanelProps) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const dict = useMessages().specs;
  const { update, isPending } = useCatalogParams();
  const ctx = { locale, dict, chipNames };
  const labels = dict.labels as Record<string, string>;
  const hasSelection = Object.keys(selection).length > 0 || inStockOnly;

  function toggleEnum(key: string, value: string, checked: boolean) {
    update((params) => {
      const current = new Set((params.get(key) ?? '').split(',').filter(Boolean));
      if (checked) current.add(value);
      else current.delete(value);
      if (current.size > 0) params.set(key, [...current].join(','));
      else params.delete(key);
    });
  }

  function toggleFlag(key: string, checked: boolean) {
    update((params) => {
      if (checked) params.set(key, '1');
      else params.delete(key);
    });
  }

  return (
    <div
      className={cn('space-y-6', isPending && 'opacity-70 transition-opacity', className)}
      aria-busy={isPending}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-steel-300">{t('found', { count: total })}</p>
        {hasSelection && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              update((params) => {
                for (const facet of facets) params.delete(facet.key);
                params.delete(STOCK_PARAM);
              })
            }
          >
            <XIcon />
            {t('resetFilters')}
          </Button>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-graphite-800 bg-graphite-950 px-3 py-2.5 text-sm">
        <Checkbox
          checked={inStockOnly}
          onCheckedChange={(checked) => toggleFlag(STOCK_PARAM, checked === true)}
        />
        {t('inStockOnly')}
      </label>

      {facets.map((facet) => {
        const unit = unitLabel(facet.unit, dict);
        const title = labels[facet.key] ?? facet.key;
        const selected = selection[facet.key];
        return (
          <fieldset key={facet.key} className="space-y-3">
            <legend className="flex w-full items-center gap-2 label-caps text-steel-300">
              {title}
              {unit && <span className="text-steel-400 normal-case">({unit})</span>}
              {facet.isCompatibilityKey && (
                <ShieldCheckIcon
                  aria-label={t('compatibilityKey')}
                  className="ml-auto size-3.5 text-brand-bright"
                />
              )}
            </legend>

            {facet.type === 'enum' && (
              <ul className="space-y-1.5">
                {facet.values!.map(({ value, count }) => {
                  const checked = Array.isArray(selected) && selected.includes(value);
                  const id = `f-${facet.key}-${value}`;
                  return (
                    <li key={value} className="flex items-center gap-2.5">
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={count === 0 && !checked}
                        onCheckedChange={(next) => toggleEnum(facet.key, value, next === true)}
                      />
                      <label
                        htmlFor={id}
                        className={cn(
                          'flex flex-1 cursor-pointer justify-between gap-2 text-sm',
                          count === 0 && !checked && 'text-steel-400',
                        )}
                      >
                        <span>{enumLabel(facet.key, value, ctx)}</span>
                        <span className="font-mono text-xs text-steel-400 tabular-nums">
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {facet.type === 'range' && (
              <RangeFilter
                // Новые значения из URL (сброс, «назад») пересоздают поля ввода
                key={rangeKey(selected)}
                facet={facet}
                unit={unit}
                value={
                  selected && !Array.isArray(selected) && selected !== true ? selected : undefined
                }
              />
            )}

            {facet.type === 'boolean' && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={selected === true}
                  onCheckedChange={(next) => toggleFlag(facet.key, next === true)}
                />
                <span className="flex-1">{t('yes')}</span>
                <span className="font-mono text-xs text-steel-400 tabular-nums">
                  {facet.trueCount}
                </span>
              </label>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
