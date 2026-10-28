'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { quoteCartAction, type CartQuoteResult } from '@/server/shop-actions';
import { useCheckoutStore } from '@/stores/checkout-store';
import { cartLines, useShopStore } from '@/stores/shop-store';
import { useStoreHydrated } from '@/stores/store-hydrator';

/**
 * Расчёт корзины на сервере: цены, наличие, промокод, доставка и услуги.
 * Пересчитывается при каждом изменении корзины или выбора в оформлении.
 */
export function useCartQuote(phone?: string | null) {
  const locale = useLocale();
  const hydrated = useStoreHydrated();
  const cart = useShopStore((s) => s.cart);
  const { promoCode, zoneCode, serviceKeys } = useCheckoutStore();
  const items = cartLines(cart);
  const key = JSON.stringify([locale, items, promoCode, zoneCode, serviceKeys, phone ?? null]);
  const [state, setState] = useState<{ key: string; data: CartQuoteResult } | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const [lang, lines, promo, zone, services, tel] = JSON.parse(key) as [
      string,
      { slug: string; qty: number }[],
      string | null,
      string,
      string[],
      string | null,
    ];
    let active = true;
    quoteCartAction({
      locale: lang,
      items: lines,
      promoCode: promo,
      zoneCode: zone,
      serviceKeys: services,
      phone: tel,
    })
      .then((data) => {
        if (active) setState({ key, data });
      })
      .catch(() => {
        /* сеть недоступна — оставляем прошлый расчёт */
      });
    return () => {
      active = false;
    };
  }, [key, hydrated]);

  return {
    data: state?.data ?? null,
    loading: !hydrated || state?.key !== key,
    empty: hydrated && items.length === 0,
  };
}
