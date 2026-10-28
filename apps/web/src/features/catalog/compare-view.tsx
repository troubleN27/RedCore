'use client';

import type { ProductSummary } from '@redcore/services/types';
import { GitCompareArrowsIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useShopStore } from '@/stores/shop-store';
import { useStoreHydrated } from '@/stores/store-hydrator';
import { formatSpecs } from '../product/spec-format';
import { useProductsBySlugs } from './use-products';

/** Прочерк для отсутствующей характеристики */
const EMPTY = '—';

export function CompareView() {
  const t = useTranslations('shop.compare');
  const locale = useLocale();
  const dict = useMessages().specs;
  const hydrated = useStoreHydrated();
  const slugs = useShopStore((s) => s.compare.slugs);
  const remove = useShopStore((s) => s.removeFromCompare);
  const clear = useShopStore((s) => s.clearCompare);
  const { products, chipNames, loading } = useProductsBySlugs(slugs, hydrated);
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  if (!hydrated || loading) return <Skeleton className="h-96 w-full" />;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
        <GitCompareArrowsIcon className="size-8 text-steel-400" />
        <p className="font-medium">{t('empty')}</p>
        <p className="max-w-md text-sm text-steel-300">{t('emptyText')}</p>
      </div>
    );
  }

  const ctx = { locale, dict, chipNames };
  const rowsByProduct = products.map(
    (p) =>
      new Map(
        formatSpecs(p.componentType, p.specs as Record<string, unknown>, ctx).map((r) => [
          r.key,
          r,
        ]),
      ),
  );
  const keys = [...new Set(rowsByProduct.flatMap((rows) => [...rows.keys()]))];
  const labels = dict.labels as Record<string, string>;
  const visibleKeys = onlyDifferences
    ? keys.filter(
        (key) => new Set(rowsByProduct.map((rows) => rows.get(key)?.value ?? EMPTY)).size > 1,
      )
    : keys;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={onlyDifferences}
            onCheckedChange={(v) => setOnlyDifferences(v === true)}
          />
          {t('onlyDifferences')}
        </label>
        <Button variant="ghost" size="sm" onClick={clear}>
          <Trash2Icon />
          {t('clear')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-graphite-800">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="align-top">
              <th scope="col" className="w-48 bg-graphite-950 p-4" />
              {products.map((product: Omit<ProductSummary, 'searchText'>) => (
                <th
                  key={product.slug}
                  scope="col"
                  className="bg-graphite-950 p-4 text-left font-normal"
                >
                  <div className="space-y-3">
                    <ProductArt type={product.componentType} brand={product.brand} size="sm" />
                    <Link
                      href={`/p/${product.slug}`}
                      className="line-clamp-2 font-medium hover:text-brand-bright"
                    >
                      {product.brand} {product.name}
                    </Link>
                    <PriceTag amount={product.priceUzs} size="sm" />
                    <Button variant="ghost" size="xs" onClick={() => remove(product.slug)}>
                      <XIcon />
                      {t('remove')}
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleKeys.map((key) => {
              const values = rowsByProduct.map((rows) => rows.get(key)?.value);
              const differs = new Set(values.map((v) => v ?? EMPTY)).size > 1;
              return (
                <tr key={key} className="border-t border-graphite-800">
                  <th
                    scope="row"
                    className="bg-graphite-950/60 px-4 py-2.5 text-left font-normal text-steel-300"
                  >
                    {labels[key] ?? key}
                  </th>
                  {values.map((value, index) => (
                    <td
                      key={products[index]!.slug}
                      className={cn('px-4 py-2.5', differs && 'text-white')}
                    >
                      {value ?? EMPTY}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
