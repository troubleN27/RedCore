'use client';

import type { ProductSummary } from '@redcore/services/types';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

type Loaded = Omit<ProductSummary, 'searchText'>;

/** Актуальные данные товаров (цены, наличие) по списку slug из localStorage. */
export function useProductsBySlugs(slugs: string[], enabled = true) {
  const locale = useLocale();
  const key = slugs.join(',');
  const [state, setState] = useState<{
    key: string;
    products: Loaded[];
    chipNames: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!enabled || key === '') return;
    const controller = new AbortController();
    fetch(`/api/products?locale=${locale}&slugs=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    })
      .then(
        (response) =>
          response.json() as Promise<{ products: Loaded[]; chipNames: Record<string, string> }>,
      )
      .then((data) => setState({ key, ...data }))
      .catch(() => {
        /* отменено или сеть недоступна — оставляем прошлое состояние */
      });
    return () => controller.abort();
  }, [key, locale, enabled]);

  // Пустой список не требует запроса — сразу «загружено»
  const loading = enabled && key !== '' && state?.key !== key;
  // Порядок — как в списке пользователя; удалённые из каталога товары пропадают
  const bySlug = new Map((state?.products ?? []).map((p) => [p.slug, p]));
  const products = slugs.map((slug) => bySlug.get(slug)).filter((p): p is Loaded => Boolean(p));
  return { products, chipNames: state?.chipNames ?? {}, loading };
}
