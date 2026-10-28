'use client';

import type { PcComponentType } from '@redcore/domain';
import { ScanSearchIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { ChatPanel } from './chat-panel';

const REVIEW = 'review' as const;
const AGENT_BY_MODE = { configurator: 'consultant', review: 'reviewer' } as const;
const REVIEW_MESSAGE = { ru: 'Проверь мою сборку', uz: 'Yigʻmamni tekshir' } as const;

/**
 * AI в конфигураторе: консультант по сборке и «Проверить сборку» (агент проверки получает
 * текущий состав). Предложенная замена применяется к черновику одной кнопкой.
 */
export function ConfiguratorAssistant() {
  const locale = useLocale() === 'uz' ? 'uz' : 'ru';
  const t = useTranslations('ai.widget');
  const [mode, setMode] = useState<'configurator' | 'review'>('configurator');
  const [auto, setAuto] = useState<{ text: string; nonce: number } | null>(null);
  const parts = useConfiguratorStore((s) => s.items.length);
  const context = () => ({
    buildItems: useConfiguratorStore.getState().items.map((i) => ({ slug: i.slug, qty: i.qty })),
  });

  return (
    <section
      className="space-y-2 rounded-xl border border-graphite-800 bg-graphite-950"
      data-testid="configurator-assistant"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
        <h2 className="font-display text-sm font-bold">{t('title')}</h2>
        <Button
          type="button"
          size="xs"
          variant={mode === 'review' ? 'default' : 'secondary'}
          data-testid="ai-review-build"
          disabled={parts === 0}
          onClick={() => {
            setMode(REVIEW);
            setAuto({ text: REVIEW_MESSAGE[locale], nonce: Date.now() });
          }}
        >
          <ScanSearchIcon />
          {t('review')}
        </Button>
      </div>
      <ChatPanel
        key={mode}
        place={mode}
        agent={AGENT_BY_MODE[mode]}
        className="h-[28rem]"
        context={context}
        autoMessage={mode === 'review' ? auto : null}
        onSwap={(slot, slug) =>
          useConfiguratorStore.getState().place(slot as PcComponentType, slug)
        }
      />
    </section>
  );
}
