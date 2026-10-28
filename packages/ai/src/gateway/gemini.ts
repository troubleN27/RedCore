import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import { CircuitBreaker } from './breaker';
import {
  emptyUsage,
  LlmUnavailableError,
  type ChatMessage,
  type LlmEvent,
  type LlmGateway,
  type LlmRequest,
  type ModelTier,
} from './types';

export interface GeminiOptions {
  apiKey: string | undefined;
  models: Record<ModelTier, string>;
  /** Запасная модель между chat и lite в цепочке (план, §8: 3.8 → 3.6 → 3.5-lite) */
  middle?: string;
  /** Лимит одной попытки (до первого и между чанками ответа) */
  timeoutMs?: number;
  /**
   * Общий лимит вызова со всеми повторами и запасными моделями. Функция чата на Vercel живёт
   * 60 с, а агент делает несколько вызовов: без общего лимита чат молча обрывался по таймауту.
   */
  deadlineMs?: number;
  breaker?: CircuitBreaker;
  /** Для тестов: подменить клиента */
  client?: Pick<GoogleGenAI, 'models'>;
  sleep?: (ms: number) => Promise<void>;
}

const RETRY_DELAYS = [300, 1200];
const ATTEMPT_TIMEOUT_MS = 15_000;
const DEADLINE_MS = 20_000;
/** Меньше этого на попытку не остаётся — дальше не пробуем */
const MIN_ATTEMPT_MS = 2_000;

function retryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500;
  const name = (error as { name?: string })?.name;
  return name === 'TimeoutError' || name === 'AbortError' || error instanceof TypeError;
}

function toContents(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role,
    parts: m.parts.map((p): Part => {
      if (p.kind === 'text') return { text: p.text };
      if (p.kind === 'call')
        return {
          functionCall: { id: p.call.id, name: p.call.name, args: p.call.args },
          ...(p.call.signature ? { thoughtSignature: p.call.signature } : {}),
        };
      return { functionResponse: { id: p.id, name: p.name, response: { result: p.result } } };
    }),
  }));
}

/**
 * Gemini через generateContentStream в stateless-режиме: история хранится у нас, ответ
 * стримится. Вызовы функций не выполняются автоматически — их исполняет цикл агента через MCP.
 *
 * Отказы: повтор с задержкой (до 2 раз) → следующая модель цепочки → circuit breaker на 60 с.
 * Повтор возможен только пока модель ещё ничего не отдала клиенту.
 */
export class GeminiGateway implements LlmGateway {
  private readonly client: Pick<GoogleGenAI, 'models'> | null;
  private readonly breaker: CircuitBreaker;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: GeminiOptions) {
    this.client =
      options.client ?? (options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : null);
    this.breaker = options.breaker ?? new CircuitBreaker();
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  available(): boolean {
    return this.client !== null && !this.breaker.isOpen();
  }

  chain(tier: ModelTier): string[] {
    const { models, middle = 'gemini-3.6-flash' } = this.options;
    const list =
      tier === 'lite'
        ? [models.lite]
        : tier === 'power'
          ? [models.power, models.chat]
          : [models.chat, middle, models.lite];
    return [...new Set(list)];
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmEvent> {
    if (!this.client) throw new LlmUnavailableError('no_key');
    if (this.breaker.isOpen()) throw new LlmUnavailableError('breaker');
    const chain = this.chain(request.tier);
    const deadline = Date.now() + (this.options.deadlineMs ?? DEADLINE_MS);
    let lastError: unknown;

    models: for (const model of chain) {
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_ATTEMPT_MS) break models;
        let emitted = false;
        try {
          const signal = AbortSignal.any([
            AbortSignal.timeout(Math.min(this.options.timeoutMs ?? ATTEMPT_TIMEOUT_MS, remaining)),
            ...(request.signal ? [request.signal] : []),
          ]);
          const response = await this.client.models.generateContentStream({
            model,
            contents: toContents(request.messages),
            config: {
              abortSignal: signal,
              systemInstruction: request.system,
              ...(request.tools?.length
                ? {
                    tools: [
                      {
                        functionDeclarations: request.tools.map((t) => ({
                          name: t.name,
                          description: t.description,
                          parametersJsonSchema: t.parameters,
                        })),
                      },
                    ],
                    automaticFunctionCalling: { disable: true },
                  }
                : {}),
              ...(request.jsonSchema
                ? { responseMimeType: 'application/json', responseJsonSchema: request.jsonSchema }
                : {}),
              ...(request.thinking
                ? {
                    thinkingConfig: {
                      thinkingLevel:
                        request.thinking === 'high' ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
                    },
                  }
                : {}),
            },
          });
          const usage = emptyUsage();
          let calls = 0;
          for await (const chunk of response) {
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
              if (part.thought) continue;
              if (part.functionCall?.name) {
                emitted = true;
                yield {
                  type: 'call',
                  call: {
                    id: part.functionCall.id ?? `call-${calls}`,
                    name: part.functionCall.name,
                    args: (part.functionCall.args ?? {}) as Record<string, unknown>,
                    ...(part.thoughtSignature ? { signature: part.thoughtSignature } : {}),
                  },
                };
                calls++;
              } else if (part.text) {
                emitted = true;
                yield { type: 'text', text: part.text };
              }
            }
            const meta = chunk.usageMetadata;
            if (meta) {
              usage.input = meta.promptTokenCount ?? usage.input;
              usage.output = meta.candidatesTokenCount ?? usage.output;
              usage.thought = meta.thoughtsTokenCount ?? usage.thought;
              usage.cached = meta.cachedContentTokenCount ?? usage.cached;
            }
          }
          this.breaker.reset();
          yield { type: 'done', model, fallbackFrom: model === chain[0] ? null : chain[0]!, usage };
          return;
        } catch (error) {
          lastError = error;
          if (emitted || request.signal?.aborted) throw error;
          if (!retryable(error)) break; // ошибка запроса (400 и т. п.) — следующая модель
          const delay = RETRY_DELAYS[attempt];
          if (delay === undefined) break;
          await this.sleep(delay);
        }
      }
    }
    this.breaker.trip();
    throw new LlmUnavailableError('failed', lastError);
  }
}

/** Шлюз из переменных окружения (GEMINI_*). Без ключа — available() === false. */
export function geminiFromEnv(
  env: Record<string, string | undefined> = process.env,
): GeminiGateway {
  const chat = env.GEMINI_MODEL_CHAT || 'gemini-3.8-flash';
  return new GeminiGateway({
    apiKey: env.GEMINI_API_KEY || undefined,
    models: {
      chat,
      power: env.GEMINI_MODEL_POWER || chat,
      lite: env.GEMINI_MODEL_LITE || 'gemini-3.5-flash-lite',
    },
  });
}
