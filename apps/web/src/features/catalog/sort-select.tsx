'use client';

import { sortOptions, type SortOption } from '@redcore/services/types';
import { ArrowUpDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCatalogParams } from './use-catalog-params';

export function SortSelect({ value }: { value: SortOption }) {
  const t = useTranslations('catalog.sort');
  const { update } = useCatalogParams();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-steel-300">
      <ArrowUpDownIcon aria-hidden="true" className="size-4 text-brand-bright" />
      <span className="sr-only">{t('label')}</span>
      <select
        value={value}
        onChange={(event) =>
          update((params) => {
            if (event.target.value === 'popular') params.delete('sort');
            else params.set('sort', event.target.value);
          })
        }
        className="h-9 rounded-md border border-graphite-800 bg-graphite-950 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {sortOptions.map((option) => (
          <option key={option} value={option}>
            {t(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
