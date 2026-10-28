'use client';

import type { ComponentType } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import {
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TruckIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { MAX_CART_QTY, useShopStore } from '@/stores/shop-store';
import { OrderTotals, PromoField } from './order-summary';
import { useCartQuote } from './use-cart-quote';

export function CartView() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { data, loading, empty } = useCartQuote();
  const { setCartQty, removeFromCart, clearCart } = useShopStore();

  // Снятые с продажи товары убираем из корзины, покупатель видит предупреждение
  const missing = data?.missing.join(',') ?? '';
  useEffect(() => {
    for (const slug of missing.split(',').filter(Boolean)) removeFromCart(slug);
  }, [missing, removeFromCart]);

  if (empty) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center" data-testid="cart-empty">
        <ShoppingCartIcon className="mx-auto size-12 text-steel-400" />
        <h2 className="font-display text-xl font-bold">{t('empty')}</h2>
        <p className="text-steel-300">{t('emptyText')}</p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/catalog">{t('toCatalog')}</Link>
          </Button>
          <Button asChild>
            <Link href="/configurator">{t('toConfigurator')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const blocked = data.lines.some((l) => l.available <= 0 || l.qty > l.available);
  const cityZone = data.zones.find((z) => z.code === 'tashkent-city');
  const freeLeft = cityZone?.freeFromUzs
    ? cityZone.freeFromUzs - (data.subtotalUzs - data.discountUzs)
    : 0;

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      data-testid="cart"
      aria-busy={loading}
    >
      <section className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-steel-300">
            {t('itemsCount', { count: data.lines.reduce((n, l) => n + l.qty, 0) })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(t('clearConfirm'))) clearCart();
            }}
          >
            <Trash2Icon />
            {t('clear')}
          </Button>
        </div>
        {data.missing.length > 0 && <p className="text-sm text-warning">{t('missing')}</p>}
        <ul className="space-y-3">
          {data.lines.map((line) => {
            const problem =
              line.available <= 0
                ? t('unavailable')
                : line.qty > line.available
                  ? t('shortage', { count: line.available })
                  : null;
            return (
              <li
                key={line.slug}
                data-testid="cart-line"
                data-slug={line.slug}
                className="flex flex-col gap-4 rounded-xl border border-graphite-800 bg-graphite-900 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ProductArt
                    type={line.componentType as ComponentType}
                    brand={line.brand}
                    size="sm"
                    className="w-16 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="label-caps text-steel-400">{line.brand}</p>
                    <Link
                      href={`/p/${line.slug}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {line.name}
                    </Link>
                    <p className="text-xs text-steel-400 tabular-nums">
                      {formatPrice(line.priceUzs, locale)}
                    </p>
                    {problem && (
                      <p className="text-xs text-danger" role="alert">
                        {problem}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="flex items-center gap-1" role="group" aria-label={line.name}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      aria-label={t('decrease')}
                      onClick={() => setCartQty(line.slug, line.qty - 1)}
                    >
                      <MinusIcon />
                    </Button>
                    <span
                      className="w-8 text-center font-mono text-sm tabular-nums"
                      data-testid="cart-qty"
                    >
                      {line.qty}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      aria-label={t('increase')}
                      disabled={line.qty >= Math.min(MAX_CART_QTY, line.available)}
                      onClick={() => setCartQty(line.slug, line.qty + 1)}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                  <PriceTag amount={line.totalUzs} size="sm" className="w-32 justify-end" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t('remove')}: ${line.name}`}
                    onClick={() => removeFromCart(line.slug)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-5 rounded-2xl border border-white/10 bg-graphite-950/80 p-5 shadow-panel">
          <h2 className="label-caps text-brand-bright">{t('summary.title')}</h2>
          <PromoField data={data} />
          <OrderTotals data={data} showDelivery={false} />
          <Button asChild size="lg" className="w-full" aria-disabled={blocked}>
            <Link
              href="/checkout"
              data-testid="to-checkout"
              onClick={(e) => {
                if (blocked) e.preventDefault();
              }}
            >
              {t('checkout')}
            </Link>
          </Button>
          <ul className="space-y-2 text-xs text-steel-400">
            <li className="flex gap-2">
              <ShieldCheckIcon className="size-4 shrink-0 text-steel-300" />
              {t('secure')}
            </li>
            {freeLeft > 0 && (
              <li className="flex gap-2">
                <TruckIcon className="size-4 shrink-0 text-steel-300" />
                {t('summary.freeDeliveryLeft', { amount: formatPrice(freeLeft, locale) })}
              </li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
