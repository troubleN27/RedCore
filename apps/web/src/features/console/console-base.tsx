'use client';

import NextLink from 'next/link';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';

// Секретный путь консоли приходит с сервера: в клиентский бандл он не зашит.
const BaseContext = createContext('');

export function ConsoleBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <BaseContext.Provider value={base}>{children}</BaseContext.Provider>;
}

export function useConsoleHref() {
  const base = useContext(BaseContext);
  // Корень консоли — сам секретный путь, без завершающего слэша (иначе лишний редирект)
  return (path: string) =>
    `${base}${path === '/' ? '' : path.startsWith('/?') ? path.slice(1) : path}`;
}

/** Ссылка внутри консоли: путь относительно секретного префикса. */
export function ConsoleLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, 'href'> & { href: string }) {
  const toHref = useConsoleHref();
  return <NextLink href={toHref(href)} {...props} />;
}
