'use client';

import { GitCompareArrowsIcon, HeartIcon, ShoppingCartIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COMPARE_LIMIT, useShopStore } from '@/stores/shop-store';
import { useStoreHydrated } from '@/stores/store-hydrator';

export function FavoriteButton({ slug, className }: { slug: string; className?: string }) {
  const t = useTranslations('product');
  const hydrated = useStoreHydrated();
  const active = useShopStore((s) => s.favorites.includes(slug)) && hydrated;
  const toggle = useShopStore((s) => s.toggleFavorite);
  const label = active ? t('removeFromFavorites') : t('addToFavorites');

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={() => toggle(slug)}
      className={cn(active && 'text-brand-bright hover:text-brand-bright', className)}
    >
      <HeartIcon className={cn(active && 'fill-current')} />
    </Button>
  );
}

export function CompareButton({
  slug,
  category,
  withLabel = false,
  className,
}: {
  slug: string;
  category: string;
  withLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations('product');
  const hydrated = useStoreHydrated();
  const active = useShopStore((s) => s.compare.slugs.includes(slug)) && hydrated;
  const toggle = useShopStore((s) => s.toggleCompare);
  const label = active ? t('inCompare') : t('addToCompare');

  function onClick() {
    const result = toggle(slug, category);
    if (result === 'limit') toast.warning(t('compareLimit', { max: COMPARE_LIMIT }));
    if (result === 'replaced-category') toast.info(t('compareOtherCategory'));
  }

  return (
    <Button
      type="button"
      variant={withLabel ? 'outline' : 'ghost'}
      size={withLabel ? 'default' : 'icon-sm'}
      aria-label={withLabel ? undefined : label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        active && 'border-brand-bright/60 text-brand-bright hover:text-brand-bright',
        className,
      )}
    >
      <GitCompareArrowsIcon />
      {withLabel && label}
    </Button>
  );
}

export function AddToCartButton({
  slug,
  name,
  disabled,
  size = 'sm',
  className,
}: {
  slug: string;
  name: string;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const add = useShopStore((s) => s.addToCart);

  return (
    <Button
      type="button"
      size={size}
      disabled={disabled}
      className={className}
      onClick={() => {
        add(slug);
        toast.success(t('addedToCart', { name }), { description: t('cartSoon') });
      }}
    >
      <ShoppingCartIcon />
      {tc('actions.addToCart')}
    </Button>
  );
}
