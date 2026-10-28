// События чата для SSE (план, §8 «Оркестрация»): типизированный поток от сервера к виджету.

export type AgentName = 'consultant' | 'reviewer' | 'support' | 'admin';

export interface UiBuildLine {
  slot: string;
  name: string;
  qty: number;
  priceUzs: number;
}

/** Карточки, которые виджет рендерит по данным из базы — не по тексту модели. */
export type UiPayload =
  | {
      kind: 'build';
      publicId: string;
      title: string;
      totalUzs: number;
      status: string;
      lines: UiBuildLine[];
      items: { slug: string; qty: number }[];
    }
  | {
      kind: 'swap';
      slot: string;
      from: { slug: string; name: string; priceUzs: number } | null;
      to: { slug: string; name: string; priceUzs: number };
      priceDeltaUzs: number;
      perfDeltaPercent: number | null;
      reason: string;
    }
  | {
      kind: 'products';
      items: { slug: string; name: string; priceUzs: number; available: number; url: string }[];
    }
  | {
      kind: 'copy';
      draftId: string;
      productName: string;
      ru: { short: string; description: string };
      uz: { short: string; description: string };
    }
  | {
      kind: 'chart';
      title: string;
      unit: 'uzs' | 'count';
      series: { label: string; value: number }[];
    }
  | { kind: 'ticket'; number: string };

export type AgentEvent =
  | { type: 'meta'; conversationId: string; agent: AgentName }
  | { type: 'text-delta'; text: string }
  /** Ответ переписывается (в нём была сумма не из инструментов) — виджет очищает текст */
  | { type: 'retract' }
  | { type: 'tool-start'; id: string; name: string }
  | { type: 'tool-end'; id: string; name: string; ok: boolean }
  | { type: 'ui'; ui: UiPayload }
  | { type: 'handoff'; from: AgentName; to: AgentName; reason: string }
  /** Ответ без LLM: нет ключа, выключено, лимит, сбой модели */
  | { type: 'fallback'; reason: string }
  | { type: 'error'; code: string }
  | { type: 'done'; model: string | null };
