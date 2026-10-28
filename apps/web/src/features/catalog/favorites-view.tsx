'use client';

import type { ProductSummary } from '@redcore/services/types';
import { HeartIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useShopStore } from '@/stores/shop-store';
import { useStoreHydrated } from '@/stores/store-hydrator';
import { ProductCard } from './product-card';
import { useProductsBySlugs } from './use-products';

export function FavoritesView() {
  const t = useTranslations('shop.favorites');
  const hydrated = useStoreHydrated();
  const slugs = useShopStore((s) => s.favorites);
  const clear = useShopStore((s) => s.clearFavorites);
  const { products, chipNames, loading } = useProductsBySlugs(slugs, hydrated);

  if (!hydrated || loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
        <HeartIcon className="size-8 text-steel-400" />
        <p className="font-medium">{t('empty')}</p>
        <p className="max-w-md text-sm text-steel-300">{t('emptyText')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clear}>
          <Trash2Icon />
          {t('clear')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            product={{ ...product, searchText: '' } as ProductSummary}
            chipNames={chipNames}
          />
        ))}
      </div>
    </div>
  );
}
