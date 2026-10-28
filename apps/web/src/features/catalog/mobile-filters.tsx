'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FiltersPanel } from './filters-panel';

export function MobileFilters(props: ComponentProps<typeof FiltersPanel>) {
  const t = useTranslations('catalog');
  const active = Object.keys(props.selection).length + (props.inStockOnly ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontalIcon />
          {t('filters')}
          {active > 0 && (
            <span className="ml-1 rounded bg-brand px-1.5 text-xs text-white tabular-nums">
              {active}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-sm overflow-y-auto border-graphite-800 bg-graphite-950"
      >
        <SheetHeader>
          <SheetTitle>{t('filters')}</SheetTitle>
        </SheetHeader>
        <FiltersPanel {...props} className="px-4 pb-8" />
      </SheetContent>
    </Sheet>
  );
}
