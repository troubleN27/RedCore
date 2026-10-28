'use client';

import type { AgentEvent, AgentName, ChatPlace, UiPayload } from '@redcore/ai';
import { useLocale } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

export interface ChatTool {
  id: string;
  name: string;
  status: 'running' | 'ok' | 'error';
}

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ui: UiPayload[];
  tools: ChatTool[];
  agent?: AgentName;
  fallback?: string;
  handoff?: AgentName;
  error?: string;
}

export interface ChatContextInput {
  buildItems?: { slug: string; qty: number }[];
  productSlug?: string;
  orderNumber?: string;
}

const storageKey = (place: ChatPlace) => `redcore-ai:${place}`;
const CHAT_URL = '/api/ai/chat';

function load(place: ChatPlace): { conversationId: string | null; messages: ChatMessageView[] } {
  try {
    const raw = sessionStorage.getItem(storageKey(place));
    if (raw)
      return JSON.parse(raw) as { conversationId: string | null; messages: ChatMessageView[] };
  } catch {
    // приватный режим или битые данные — начинаем с чистого листа
  }
  return { conversationId: null, messages: [] };
}

/** Разбор SSE: события «data: {...}» через пустую строку. */
async function* readEvents(response: Response): AsyncGenerator<AgentEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const data = chunk.split('\n').find((line) => line.startsWith('data: '));
      if (data) yield JSON.parse(data.slice(6)) as AgentEvent;
    }
  }
}

/**
 * Чат с агентом: история хранится в sessionStorage по месту (виджет, конфигуратор,
 * кабинет, консоль), ответ стримится и собирается из событий SSE.
 */
export function useChat(place: ChatPlace) {
  const locale = useLocale();
  const [state, setState] = useState(() =>
    typeof window === 'undefined' ? { conversationId: null, messages: [] } : load(place),
  );
  const [pending, setPending] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const persist = useCallback(
    (next: { conversationId: string | null; messages: ChatMessageView[] }) => {
      try {
        sessionStorage.setItem(storageKey(place), JSON.stringify(next));
      } catch {
        // не критично
      }
    },
    [place],
  );

  const send = useCallback(
    async (message: string, context: ChatContextInput = {}) => {
      const text = message.trim();
      if (!text || pending) return;
      const userMessage: ChatMessageView = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        ui: [],
        tools: [],
      };
      const reply: ChatMessageView = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        ui: [],
        tools: [],
      };
      let conversationId = state.conversationId;
      let messages = [...state.messages, userMessage, reply];
      const update = (patch: (m: ChatMessageView) => ChatMessageView) => {
        messages = messages.map((m) => (m.id === reply.id ? patch(m) : m));
        setState({ conversationId, messages });
      };
      setState({ conversationId, messages });
      setPending(true);
      const controller = new AbortController();
      abort.current = controller;
      try {
        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text, place, conversationId, locale, context }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          update((m) => ({ ...m, error: body.error ?? 'failed' }));
          return;
        }
        for await (const event of readEvents(response)) {
          switch (event.type) {
            case 'meta':
              conversationId = event.conversationId;
              update((m) => ({ ...m, agent: event.agent }));
              break;
            case 'text-delta':
              update((m) => ({ ...m, text: m.text + event.text }));
              break;
            case 'retract':
              update((m) => ({ ...m, text: '' }));
              break;
            case 'tool-start':
              update((m) => ({
                ...m,
                tools: [...m.tools, { id: event.id, name: event.name, status: 'running' }],
              }));
              break;
            case 'tool-end':
              update((m) => ({
                ...m,
                tools: m.tools.map((t) =>
                  t.id === event.id && t.status === 'running'
                    ? { ...t, status: event.ok ? 'ok' : 'error' }
                    : t,
                ),
              }));
              break;
            case 'ui':
              update((m) => ({ ...m, ui: [...m.ui, event.ui] }));
              break;
            case 'handoff':
              update((m) => ({ ...m, handoff: event.to, agent: event.to }));
              break;
            case 'fallback':
              update((m) => ({ ...m, fallback: event.reason }));
              break;
            case 'error':
              update((m) => ({ ...m, error: event.code }));
              break;
            case 'done':
              break;
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') update((m) => ({ ...m, error: 'failed' }));
      } finally {
        setPending(false);
        abort.current = null;
        persist({ conversationId, messages });
      }
    },
    [locale, pending, persist, place, state],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    const empty = { conversationId: null, messages: [] };
    setState(empty);
    persist(empty);
  }, [persist]);

  const stop = useCallback(() => abort.current?.abort(), []);

  return { messages: state.messages, pending, send, reset, stop };
}
