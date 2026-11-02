'use client';

import { ChatWidget } from '@/features/chat/chat-widget';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';
import { CONSOLE_SEGMENT } from '@/lib/admin-path';
import { useScrollTopOnReload } from './use-scroll-top-on-reload';

/** Шапка и подвал магазина — везде, кроме админ-консоли (у неё свой каркас). */
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const segments = useSelectedLayoutSegments();
  useScrollTopOnReload();
  if (segments[0] === CONSOLE_SEGMENT) return <>{children}</>;
  return (
    <>
      {header}
      {/* Над подвалом: выпадающие списки (поиск) не уходят под него */}
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      {footer}
      <ChatWidget />
    </>
  );
}
