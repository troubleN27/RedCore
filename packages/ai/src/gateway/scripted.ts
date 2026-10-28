import { emptyUsage, type LlmEvent, type LlmGateway, type LlmRequest } from './types';

export type ScriptStep = (
  request: LlmRequest,
  turn: number,
) => (LlmEvent | { type: 'throw'; error: Error })[];

/**
 * Тестовый шлюз: каждый вызов stream() проигрывает следующий шаг сценария. Позволяет
 * проверить цикл агента, инструменты, guard по суммам и фолбэки без сети и ключа.
 */
export class ScriptedGateway implements LlmGateway {
  readonly requests: LlmRequest[] = [];
  private turn = 0;

  constructor(
    private readonly steps: ScriptStep[],
    private readonly model = 'scripted-model',
    private readonly up = true,
  ) {}

  available(): boolean {
    return this.up;
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmEvent> {
    this.requests.push(request);
    const step = this.steps[Math.min(this.turn, this.steps.length - 1)]!;
    const events = step(request, this.turn++);
    for (const event of events) {
      if (event.type === 'throw') throw event.error;
      yield event;
    }
    if (!events.some((e) => e.type === 'done'))
      yield {
        type: 'done',
        model: this.model,
        fallbackFrom: null,
        usage: { ...emptyUsage(), input: 100, output: 20 },
      };
  }
}

/** Шаг сценария: просто текст ответа. */
export const say =
  (text: string): ScriptStep =>
  () => [{ type: 'text', text }];

/** Шаг сценария: вызвать инструмент(ы). */
export const callTools =
  (...calls: { name: string; args: Record<string, unknown> }[]): ScriptStep =>
  () =>
    calls.map((c, i) => ({
      type: 'call' as const,
      call: { id: `call-${i}`, name: c.name, args: c.args },
    }));
