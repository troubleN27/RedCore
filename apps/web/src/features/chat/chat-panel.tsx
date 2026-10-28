'use client';

import type { AgentName, ChatPlace, UiPayload } from '@redcore/ai';
import { formatPrice } from '@redcore/i18n';
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  Loader2Icon,
  RefreshCwIcon,
  SendIcon,
  SquareIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useChat, type ChatContextInput, type ChatMessageView } from './use-chat';

const MAX_INPUT = 2000;
const CONFIGURATOR = '/configurator';

function BuildCard({ ui }: { ui: Extract<UiPayload, { kind: 'build' }> }) {
  const t = useTranslations('ai.widget');
  const tSlots = useTranslations('configurator.slots');
  const locale = useLocale();
  return (
    <div
      className="space-y-2 rounded-lg border border-graphite-700 bg-graphite-900 p-3"
      data-testid="chat-build"
    >
      <p className="font-display text-sm font-bold">{ui.title}</p>
      <ul className="space-y-0.5 text-xs">
        {ui.lines.map((line) => (
          <li key={`${line.slot}:${line.name}`} className="flex gap-2">
            <span className="w-20 shrink-0 text-steel-400">{tSlots(line.slot as 'cpu')}</span>
            <span className="min-w-0 flex-1 truncate">
              {line.name}
              {line.qty > 1 && ` ×${line.qty}`}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-graphite-800 pt-2">
        <span className="text-xs text-steel-400">
          {t('build.total')}{' '}
          <span className="font-display text-sm font-bold text-white tabular-nums">
            {formatPrice(ui.totalUzs, locale)}
          </span>
        </span>
        <Button asChild size="xs">
          <Link href={`${CONFIGURATOR}?build=${ui.publicId}`} data-testid="chat-build-open">
            {t('build.open')}
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SwapCard({
  ui,
  onSwap,
}: {
  ui: Extract<UiPayload, { kind: 'swap' }>;
  onSwap?: (slot: string, slug: string) => void;
}) {
  const t = useTranslations('ai.widget');
  const tSlots = useTranslations('configurator.slots');
  const locale = useLocale();
  const [done, setDone] = useState(false);
  return (
    <div
      className="space-y-2 rounded-lg border border-graphite-700 bg-graphite-900 p-3 text-xs"
      data-testid="chat-swap"
    >
      <p className="font-semibold">{t('swap.title', { slot: tSlots(ui.slot as 'cpu') })}</p>
      {ui.from && <p className="text-steel-400 line-through">{ui.from.name}</p>}
      <p className="font-semibold text-white">{ui.to.name}</p>
      <p className="text-steel-300">{ui.reason}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn('tabular-nums', ui.priceDeltaUzs > 0 ? 'text-warning' : 'text-success')}
        >
          {ui.priceDeltaUzs > 0 ? '+' : ''}
          {formatPrice(ui.priceDeltaUzs, locale)}
          {ui.perfDeltaPercent !== null &&
            ` · ${t('swap.perf', { delta: ui.perfDeltaPercent > 0 ? `+${ui.perfDeltaPercent}` : ui.perfDeltaPercent })}`}
        </span>
        {onSwap && (
          <Button
            type="button"
            size="xs"
            disabled={done}
            data-testid="chat-swap-apply"
            onClick={() => {
              onSwap(ui.slot, ui.to.slug);
              setDone(true);
              toast.success(t('swap.replaced'));
            }}
          >
            {done ? <CheckIcon /> : null}
            {t('swap.replace')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ChartCard({ ui }: { ui: Extract<UiPayload, { kind: 'chart' }> }) {
  const locale = useLocale();
  const max = Math.max(1, ...ui.series.map((s) => s.value));
  return (
    <div
      className="rounded-lg border border-graphite-700 bg-graphite-900 p-3"
      data-testid="chat-chart"
    >
      <div
        className="flex h-28 items-end gap-1"
        role="img"
        aria-label={ui.series.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {ui.series.map((s) => (
          <div
            key={s.label}
            className="flex flex-1 flex-col items-center gap-1"
            title={ui.unit === 'uzs' ? formatPrice(s.value, locale) : String(s.value)}
          >
            <div
              className="w-full rounded-t bg-brand"
              style={{ height: `${Math.max(2, (s.value / max) * 96)}px` }}
            />
            <span className="text-[9px] text-steel-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UiCard({ ui, onSwap }: { ui: UiPayload; onSwap?: (slot: string, slug: string) => void }) {
  const t = useTranslations('ai.widget');
  const locale = useLocale();
  switch (ui.kind) {
    case 'build':
      return <BuildCard ui={ui} />;
    case 'swap':
      return <SwapCard ui={ui} onSwap={onSwap} />;
    case 'chart':
      return <ChartCard ui={ui} />;
    case 'products':
      return (
        <ul className="space-y-1" data-testid="chat-products">
          {ui.items.map((p) => (
            <li key={p.slug}>
              <a
                href={p.url}
                className="flex justify-between gap-2 rounded-md border border-graphite-800 px-2 py-1.5 text-xs hover:border-brand-bright/50"
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatPrice(p.priceUzs, locale)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      );
    case 'copy':
      return (
        <div
          className="space-y-1 rounded-lg border border-graphite-700 bg-graphite-900 p-3 text-xs"
          data-testid="chat-copy"
        >
          <p className="font-semibold">{t('copy.title', { name: ui.productName })}</p>
          <p className="text-steel-300">{ui.ru.short}</p>
          <p className="text-steel-400">{t('copy.note')}</p>
        </div>
      );
    case 'ticket':
      return <p className="text-xs text-success">{t('ticket', { number: ui.number })}</p>;
  }
}

function Message({
  message,
  onSwap,
}: {
  message: ChatMessageView;
  onSwap?: (slot: string, slug: string) => void;
}) {
  const t = useTranslations('ai.widget');
  if (message.role === 'user') {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm whitespace-pre-wrap text-white">
        {message.text}
      </div>
    );
  }
  const working = message.tools.some((tool) => tool.status === 'running');
  return (
    <div
      className="max-w-[92%] space-y-2"
      data-testid="chat-reply"
      data-agent={message.agent ?? ''}
      data-fallback={message.fallback ?? ''}
    >
      {message.fallback && (
        <p
          className="flex items-center gap-1.5 text-[11px] text-warning"
          data-testid="chat-fallback"
        >
          <TriangleAlertIcon className="size-3.5" />
          {t('fallbackBanner')}
        </p>
      )}
      {message.handoff && (
        <p className="text-[11px] text-steel-400">
          {t('handoff', { agent: t(`agents.${message.handoff}`) })}
        </p>
      )}
      {message.tools.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {message.tools.map((tool) => (
            <li
              key={tool.id + tool.name}
              data-testid="chat-tool"
              data-tool={tool.name}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                tool.status === 'error'
                  ? 'border-danger/40 text-danger'
                  : 'border-graphite-700 text-steel-300',
              )}
            >
              {tool.status === 'running' ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : tool.status === 'ok' ? (
                <CheckIcon className="size-3" />
              ) : (
                <XIcon className="size-3" />
              )}
              {t.has(`tools.${tool.name}` as 'tools.search_products')
                ? t(`tools.${tool.name}` as 'tools.search_products')
                : tool.name}
            </li>
          ))}
        </ul>
      )}
      {message.text && (
        <div
          className="rounded-2xl rounded-bl-sm bg-graphite-800 px-3 py-2 text-sm whitespace-pre-wrap"
          data-testid="chat-text"
        >
          {message.text}
        </div>
      )}
      {message.ui.map((ui, i) => (
        <UiCard key={i} ui={ui} onSwap={onSwap} />
      ))}
      {!message.text && !message.error && message.ui.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-steel-400">
          <Loader2Icon className="size-3.5 animate-spin" />
          {working ? null : t('typing')}
        </p>
      )}
      {message.error && (
        <p className="text-xs text-danger" data-testid="chat-error">
          {t(
            `errors.${message.error === 'rate_limited' || message.error === 'too_long' || message.error === 'forbidden' ? message.error : 'failed'}`,
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Чат с агентом. Место (place) определяет агента: виджет — по интенту, конфигуратор —
 * консультант, проверка — ревьюер, кабинет и заказ — поддержка, консоль — админ-агент.
 */
export function ChatPanel({
  place,
  agent,
  context,
  onSwap,
  autoMessage,
  className,
}: {
  place: ChatPlace;
  /** Агент для приветствия и подсказок */
  agent: AgentName;
  context?: () => ChatContextInput;
  onSwap?: (slot: string, slug: string) => void;
  /** Сообщение, которое отправить сразу (кнопка «Проверить сборку») */
  autoMessage?: { text: string; nonce: number } | null;
  className?: string;
}) {
  const t = useTranslations('ai.widget');
  const messages = useMessages() as unknown as {
    ai: { widget: { suggestions: Record<AgentName, string[]> } };
  };
  const { messages: list, pending, send, reset, stop } = useChat(place);
  const [input, setInput] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [list]);

  useEffect(() => {
    if (autoMessage && autoMessage.nonce !== lastNonce.current) {
      lastNonce.current = autoMessage.nonce;
      void send(autoMessage.text, context?.() ?? {});
    }
  }, [autoMessage, context, send]);

  const submit = (text: string) => {
    if (text.length > MAX_INPUT) {
      toast.error(t('tooLong', { max: MAX_INPUT }));
      return;
    }
    void send(text, context?.() ?? {});
    setInput('');
  };

  return (
    <div
      className={cn('flex min-h-0 flex-col', className)}
      data-testid="chat-panel"
      data-place={place}
      data-pending={pending}
    >
      <div className="flex items-center justify-between gap-2 border-b border-graphite-800 px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BotIcon className="size-4 text-brand-bright" />
          {t(`agents.${agent}`)}
        </p>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={reset}
          disabled={list.length === 0}
        >
          <RefreshCwIcon />
          {t('newChat')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {list.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-steel-300">{t(`greeting.${agent}`)}</p>
            <div className="flex flex-wrap gap-1.5">
              {(messages.ai.widget.suggestions[agent] ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="text-steel-200 rounded-full border border-graphite-700 px-2.5 py-1 text-left text-xs hover:border-brand-bright/60"
                  data-testid="chat-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {list.map((m) => (
          <Message key={m.id} message={m} onSwap={onSwap} />
        ))}
        <div ref={bottom} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-graphite-800 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          maxLength={MAX_INPUT}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-graphite-700 bg-graphite-900 px-2.5 py-2 text-sm"
          data-testid="chat-input"
        />
        {pending ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={stop}
            aria-label={t('stop')}
          >
            <SquareIcon />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            aria-label={t('send')}
            data-testid="chat-send"
          >
            <SendIcon />
          </Button>
        )}
      </form>
      <p className="px-3 pb-2 text-[10px] text-steel-400">{t('disclaimer')}</p>
    </div>
  );
}
