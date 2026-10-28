'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * true только в браузере после гидрации. Стор читает localStorage синхронно при создании,
 * но сервер о нём не знает — до гидрации показываем «пустое» состояние, как в SSR-разметке.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
