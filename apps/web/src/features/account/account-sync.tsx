'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { mergeAccountStateAction, syncAccountStateAction } from '@/server/shop-actions';
import { cartLines, useShopStore } from '@/stores/shop-store';

const MERGED_KEY = 'redcore-merged-user';
const SYNC_DELAY_MS = 800;

/**
 * Корзина и избранное: гость хранит их в браузере. После входа браузерное состояние
 * один раз сливается с аккаунтом, дальше каждое изменение сохраняется на сервере.
 */
export function AccountSync() {
  const { data } = useSession();
  const userId = data?.user.id ?? null;
  const ready = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      ready.current = null;
      return;
    }
    let cancelled = false;
    const merged = (() => {
      try {
        return sessionStorage.getItem(MERGED_KEY) === userId;
      } catch {
        return false;
      }
    })();
    const { cart, favorites } = useShopStore.getState();
    const run = merged
      ? Promise.resolve(null)
      : mergeAccountStateAction({ cart: cartLines(cart), favorites });
    void run.then((state) => {
      if (cancelled) return;
      if (state) useShopStore.getState().replaceAccountState(state);
      try {
        sessionStorage.setItem(MERGED_KEY, userId);
      } catch {
        /* без sessionStorage слияние просто повторится при следующей загрузке */
      }
      ready.current = userId;
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useShopStore.subscribe((state, previous) => {
      if (!ready.current) return;
      if (state.cart === previous.cart && state.favorites === previous.favorites) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void syncAccountStateAction({ cart: cartLines(state.cart), favorites: state.favorites });
      }, SYNC_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
