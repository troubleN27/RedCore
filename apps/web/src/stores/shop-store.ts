'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './safe-storage';

// Избранное, сравнение и корзина гостя — в localStorage браузера. После входа (этап 4)
// избранное и корзина синхронизируются с аккаунтом в БД.

export const COMPARE_LIMIT = 4;

export type CompareResult = 'added' | 'removed' | 'limit' | 'replaced-category';

interface ShopState {
  favorites: string[];
  compare: { category: string | null; slugs: string[] };
  cart: Record<string, number>;
  toggleFavorite: (slug: string) => boolean;
  clearFavorites: () => void;
  toggleCompare: (slug: string, category: string) => CompareResult;
  removeFromCompare: (slug: string) => void;
  clearCompare: () => void;
  addToCart: (slug: string, qty?: number) => void;
  setCartQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  /** Состояние из аккаунта после слияния при входе */
  replaceAccountState: (state: {
    cart: { slug: string; qty: number }[];
    favorites: string[];
  }) => void;
}

export const MAX_CART_QTY = 20;

export function cartLines(cart: Record<string, number>): { slug: string; qty: number }[] {
  return Object.entries(cart).map(([slug, qty]) => ({ slug, qty }));
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      favorites: [],
      compare: { category: null, slugs: [] },
      cart: {},

      toggleFavorite: (slug) => {
        const has = get().favorites.includes(slug);
        set({
          favorites: has ? get().favorites.filter((s) => s !== slug) : [slug, ...get().favorites],
        });
        return !has;
      },
      clearFavorites: () => set({ favorites: [] }),

      toggleCompare: (slug, category) => {
        const { compare } = get();
        if (compare.slugs.includes(slug)) {
          const slugs = compare.slugs.filter((s) => s !== slug);
          set({ compare: { category: slugs.length > 0 ? compare.category : null, slugs } });
          return 'removed';
        }
        // Сравнивать имеет смысл только товары одной категории
        if (compare.category && compare.category !== category) {
          set({ compare: { category, slugs: [slug] } });
          return 'replaced-category';
        }
        if (compare.slugs.length >= COMPARE_LIMIT) return 'limit';
        set({ compare: { category, slugs: [...compare.slugs, slug] } });
        return 'added';
      },
      removeFromCompare: (slug) => {
        const slugs = get().compare.slugs.filter((s) => s !== slug);
        set({ compare: { category: slugs.length > 0 ? get().compare.category : null, slugs } });
      },
      clearCompare: () => set({ compare: { category: null, slugs: [] } }),

      addToCart: (slug, qty = 1) =>
        set({
          cart: { ...get().cart, [slug]: Math.min((get().cart[slug] ?? 0) + qty, MAX_CART_QTY) },
        }),
      setCartQty: (slug, qty) => {
        if (qty <= 0) return get().removeFromCart(slug);
        set({ cart: { ...get().cart, [slug]: Math.min(qty, MAX_CART_QTY) } });
      },
      removeFromCart: (slug) => {
        const { [slug]: _removed, ...rest } = get().cart;
        set({ cart: rest });
      },
      clearCart: () => set({ cart: {} }),
      replaceAccountState: ({ cart, favorites }) =>
        set({ cart: Object.fromEntries(cart.map((l) => [l.slug, l.qty])), favorites }),
    }),
    {
      name: 'redcore-shop',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
