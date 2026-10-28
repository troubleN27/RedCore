'use client';

import { ChatWidget } from '@/features/chat/chat-widget';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';
import { CONSOLE_SEGMENT } from '@/lib/admin-path';

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
  if (segments[0] === CONSOLE_SEGMENT) return <>{children}</>;
  return (
    <>
      {header}
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer}
      <ChatWidget />
    </>
  );
}
