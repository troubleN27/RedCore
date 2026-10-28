// Шлюз LLM (план, §8): агенты не знают о провайдере. Сообщения и события — свои типы;
// реализация Gemini переводит их в формат @google/genai, тестовая — проигрывает сценарий.

export type ModelTier = 'chat' | 'power' | 'lite';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ChatPart =
  | { kind: 'text'; text: string }
  | { kind: 'call'; call: ToolCall }
  | { kind: 'result'; id: string; name: string; result: unknown };

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface ToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema аргументов (из MCP listTools или UI-инструментов) */
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  tier: ModelTier;
  system: string;
  messages: ChatMessage[];
  tools?: ToolDeclaration[];
  /** Структурированный ответ по JSON Schema (классификатор, черновики описаний) */
  jsonSchema?: Record<string, unknown>;
  thinking?: 'low' | 'high';
  signal?: AbortSignal;
}

export interface LlmUsage {
  input: number;
  output: number;
  thought: number;
  cached: number;
}

export type LlmEvent =
  | { type: 'text'; text: string }
  | { type: 'call'; call: ToolCall }
  | { type: 'done'; model: string; fallbackFrom: string | null; usage: LlmUsage };

export interface LlmGateway {
  /** false — ключа нет или цепь разомкнута: агенты сразу идут в детерминированный режим */
  available(): boolean;
  stream(request: LlmRequest): AsyncIterable<LlmEvent>;
}

/** Все модели цепочки не ответили (после повторов) или цепь разомкнута. */
export class LlmUnavailableError extends Error {
  constructor(
    public readonly reason: 'no_key' | 'breaker' | 'failed',
    public override readonly cause?: unknown,
  ) {
    super(`LLM unavailable: ${reason}`);
  }
}

export const emptyUsage = (): LlmUsage => ({ input: 0, output: 0, thought: 0, cached: 0 });
