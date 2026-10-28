'use client';

import type { AgentName, ChatPlace } from '@redcore/ai';
import { BotIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSelectedLayoutSegments } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChatPanel } from './chat-panel';

/** Место на сайте по сегментам маршрута: от него зависят агент и контекст запроса. */
function placeOf(
  segments: string[],
): { place: ChatPlace; agent: AgentName; productSlug?: string; orderNumber?: string } | null {
  const [group, section, param] = segments[0]?.startsWith('(') ? segments : ['', ...segments];
  void group;
  if (section === 'configurator') return null; // в конфигураторе — своя панель
  if (section === 'p' && param)
    return { place: 'product', agent: 'consultant', productSlug: param };
  if (section === 'orders' && param)
    return { place: 'order', agent: 'support', orderNumber: param };
  if (section === 'account') return { place: 'account', agent: 'support' };
  return { place: 'widget', agent: 'consultant' };
}

/** Плавающий AI-ассистент на страницах магазина (на телефоне — во весь экран). */
export function ChatWidget() {
  const t = useTranslations('ai.widget');
  const segments = useSelectedLayoutSegments();
  const [open, setOpen] = useState(false);
  const where = placeOf(segments);
  if (!where) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-graphite-950 sm:inset-auto sm:right-4 sm:bottom-20 sm:h-[34rem] sm:w-[24rem] sm:rounded-2xl sm:border sm:border-graphite-700 sm:shadow-2xl"
          role="dialog"
          aria-label={t('title')}
          data-testid="chat-widget"
        >
          <div className="flex items-center justify-between border-b border-graphite-800 px-3 py-2 sm:hidden">
            <p className="font-display text-sm font-bold">{t('title')}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')}>
              <XIcon className="size-5" />
            </button>
          </div>
          <ChatPanel
            key={where.place}
            place={where.place}
            agent={where.agent}
            className="flex-1"
            context={() => ({ productSlug: where.productSlug, orderNumber: where.orderNumber })}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('close') : t('open')}
        aria-expanded={open}
        data-testid="chat-toggle"
        className={cn(
          'fixed right-4 bottom-20 z-40 grid size-12 place-items-center rounded-full bg-brand text-white shadow-[0_0_24px_rgb(255_40_0/0.45)] transition-transform hover:scale-105 lg:bottom-6',
          open && 'hidden sm:bottom-6 sm:grid',
        )}
      >
        {open ? <XIcon className="size-5" /> : <BotIcon className="size-5" />}
      </button>
    </>
  );
}
