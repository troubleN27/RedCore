import { ApiError } from '@google/genai';
import {
  aiDrafts,
  aiRuns,
  aiToolCalls,
  productTranslations,
  user,
  type Database,
} from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import {
  getCatalogSnapshot,
  listPendingDrafts,
  placeOrder,
  recordRun,
  reviewDraft,
  updateAiSettings,
  DEFAULT_AI_SETTINGS,
  type CatalogSnapshot,
} from '@redcore/services';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentEvent, UiPayload } from './agents/events';
import { parseBudget, parsePurpose } from './agents/fallback';
import { unknownAmounts } from './agents/run';
import { CircuitBreaker } from './gateway/breaker';
import { GeminiGateway } from './gateway/gemini';
import { callTools, say, ScriptedGateway, type ScriptStep } from './gateway/scripted';
import { LlmUnavailableError, type LlmRequest } from './gateway/types';
import { MemoryRateLimiter } from './limits';
import { chat, classifyByKeywords, type ChatActor, type ChatPlace } from './orchestrator';

let testDb: TestDatabase;
let db: Database;
let snapshot: CatalogSnapshot;
let customerId: string;
let otherOrderNumber: string;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  snapshot = await getCatalogSnapshot(db, 'ru');
  const users = await db.select({ id: user.id, role: user.role }).from(user);
  customerId = users.find((u) => u.role !== 'admin' && u.role !== 'manager')!.id;
  const product = snapshot.products.find((p) => p.componentType === 'ram' && p.available > 0)!;
  const placed = await placeOrder(
    db,
    snapshot,
    {
      checkoutAttemptId: randomUUID(),
      items: [{ slug: product.slug, qty: 1 }],
      contact: { name: 'Чужой Покупатель', phone: '+998935554433' },
      zoneCode: 'pickup',
      paymentMethod: 'cod',
    },
    { locale: 'ru', cardEnabled: true },
  );
  otherOrderNumber = placed.number;
});

afterAll(async () => {
  await testDb.close();
});

const guest: ChatActor = { userId: null, guestToken: 'guest-test', role: null, label: 'guest' };

async function run(
  gateway: ScriptedGateway | GeminiGateway,
  message: string,
  place: ChatPlace = 'configurator',
  actor: ChatActor = guest,
  context: { buildItems?: { slug: string; qty: number }[] } = {},
) {
  const events: AgentEvent[] = [];
  for await (const event of chat({
    db,
    gateway,
    place,
    message,
    locale: 'ru',
    actor,
    context,
    siteUrl: 'https://redcore.test',
    cardEnabled: true,
  })) {
    events.push(event);
  }
  const text = events.flatMap((e) => (e.type === 'text-delta' ? [e.text] : [])).join('');
  const ui = events.flatMap((e) => (e.type === 'ui' ? [e.ui] : []));
  return { events, text, ui, types: events.map((e) => e.type) };
}

/** Из запроса к модели — последний результат инструмента с этим именем. */
function lastResult(request: LlmRequest, name: string): unknown {
  for (const message of [...request.messages].reverse()) {
    for (const part of message.parts)
      if (part.kind === 'result' && part.name === name) return part.result;
  }
  return undefined;
}

describe('агенты: цикл с инструментами MCP', () => {
  it('консультант: подбор → карточка сборки → ответ с ценой из инструмента; запуск и вызовы в журнале', async () => {
    const proposeBalanced: ScriptStep = (request) => {
      const builds = lastResult(request, 'generate_builds') as { balanced: { items: unknown[] } };
      return [
        {
          type: 'call',
          call: {
            id: 'p1',
            name: 'propose_build',
            args: { title: 'Оптимум', items: builds.balanced.items },
          },
        },
      ];
    };
    const answer: ScriptStep = (request) => {
      const shown = lastResult(request, 'generate_builds') as { balanced: { total: string } };
      return [
        { type: 'text', text: `Оптимальная сборка стоит ${shown.balanced.total}. FPS — оценка.` },
      ];
    };
    const gateway = new ScriptedGateway([
      callTools({ name: 'generate_builds', args: { budgetUzs: 15_000_000, purpose: 'gaming' } }),
      proposeBalanced,
      answer,
    ]);
    const { events, text, ui, types } = await run(gateway, 'Собери игровой ПК до 15 млн сум');

    expect(types[0]).toBe('meta');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool-end', name: 'generate_builds', ok: true }),
    );
    const build = ui.find((u): u is Extract<UiPayload, { kind: 'build' }> => u.kind === 'build')!;
    expect(build.publicId).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(build.totalUzs).toBeLessThanOrEqual(15_000_000);
    expect(text).toMatch(/сум/);
    expect(types).not.toContain('retract');
    // Инструменты агенту объявлены, системный промпт с директивой языка
    expect(gateway.requests[0]!.tools!.map((t) => t.name)).toEqual(
      expect.arrayContaining(['search_products', 'generate_builds', 'propose_build', 'handoff']),
    );
    expect(gateway.requests[0]!.system).toContain('Reply in Russian');

    const [runRow] = await db.select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(1);
    expect(runRow).toMatchObject({
      agent: 'consultant',
      model: 'scripted-model',
      steps: 3,
      guardRetried: false,
    });
    expect(runRow!.inputTokens).toBe(300);
    const calls = await db.select().from(aiToolCalls).where(eq(aiToolCalls.runId, runRow!.id));
    expect(calls.map((c) => c.tool)).toEqual(['generate_builds']);
  });

  it('guard: сумма, которой нет в инструментах, — ответ переписывается', async () => {
    const gateway = new ScriptedGateway([
      say('Такой ПК обойдётся в 99 999 999 сум.'),
      say('Уточните бюджет — подберу из наличия.'),
    ]);
    const { types, text } = await run(gateway, 'Сколько стоит топовый ПК?');
    expect(types).toContain('retract');
    expect(text).toContain('Уточните бюджет');
    expect(gateway.requests[1]!.tools).toBeUndefined();
    const [runRow] = await db.select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(1);
    expect(runRow!.guardRetried).toBe(true);
    expect(unknownAmounts('Итого 12 450 000 сум', ['{"totalUzs":12450000}'])).toEqual([]);
    expect(unknownAmounts('Итого 1 000 000 soʻm', ['{"x":2}'])).toEqual(['1 000 000 soʻm']);
  });

  it('handoff: консультант передаёт вопрос о доставке поддержке', async () => {
    const gateway = new ScriptedGateway([
      callTools({ name: 'handoff', args: { agent: 'support', reason: 'delivery question' } }),
      callTools({ name: 'get_policy', args: { topic: 'delivery' } }),
      say('Доставка по Ташкенту — 1–2 дня.'),
    ]);
    const { events, text } = await run(gateway, 'Сколько идёт доставка?');
    expect(events).toContainEqual({
      type: 'handoff',
      from: 'consultant',
      to: 'support',
      reason: 'delivery question',
    });
    expect(text).toContain('1–2 дня');
    // У поддержки свой набор инструментов
    expect(gateway.requests[1]!.tools!.map((t) => t.name)).toContain('get_policy');
    expect(gateway.requests[1]!.tools!.map((t) => t.name)).not.toContain('generate_builds');
  });

  it('поддержка: чужой номер заказа — отказ инструмента, без данных заказа', async () => {
    const gateway = new ScriptedGateway([
      callTools({ name: 'get_order_status', args: { number: otherOrderNumber } }),
      (request) => {
        const result = lastResult(request, 'get_order_status') as { error: string };
        return [
          {
            type: 'text',
            text: result.error === 'not_found' ? 'Заказ не найден или нет доступа.' : 'LEAK',
          },
        ];
      },
    ]);
    const actor: ChatActor = { userId: customerId, guestToken: null, role: 'customer', label: 'c' };
    const { events, text } = await run(
      gateway,
      `Где мой заказ ${otherOrderNumber}?`,
      'account',
      actor,
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool-end', name: 'get_order_status', ok: false }),
    );
    expect(text).toBe('Заказ не найден или нет доступа.');
  });

  it('консоль: только для персонала; админ-агент готовит черновик описания, применяет менеджер', async () => {
    const forbidden = await run(new ScriptedGateway([say('x')]), 'Продажи', 'console');
    expect(forbidden.events).toContainEqual({ type: 'error', code: 'forbidden' });

    const product = snapshot.products.find((p) => p.componentType === 'gpu')!;
    const copy = {
      short: 'Видеокарта для игр в 1440p с тихим охлаждением.',
      description:
        'Тестовое описание видеокарты для проверки черновиков: характеристики берутся из каталога магазина.',
    };
    const gateway = new ScriptedGateway([
      callTools({ name: 'propose_product_copy', args: { slug: product.slug, ru: copy, uz: copy } }),
      say('Черновик готов, применить можно в консоли.'),
    ]);
    const staff: ChatActor = { userId: null, guestToken: null, role: 'manager', label: 'mgr' };
    const { ui } = await run(gateway, `Опиши ${product.name}`, 'console', staff);
    const draft = ui.find((u) => u.kind === 'copy') as Extract<UiPayload, { kind: 'copy' }>;
    expect(draft.draftId).toBeTruthy();
    expect((await listPendingDrafts(db)).map((d) => d.id)).toContain(draft.draftId);
    // До подтверждения витрина не меняется
    const [before] = await db
      .select()
      .from(productTranslations)
      .where(
        and(eq(productTranslations.productId, product.id), eq(productTranslations.locale, 'ru')),
      );
    expect(before!.shortDescription).not.toBe(copy.short);
    const manager = (
      await db.select({ id: user.id }).from(user).where(eq(user.role, 'manager'))
    )[0]!.id;
    await reviewDraft(db, draft.draftId, 'applied', manager);
    const [after] = await db
      .select()
      .from(productTranslations)
      .where(
        and(eq(productTranslations.productId, product.id), eq(productTranslations.locale, 'ru')),
      );
    expect(after).toMatchObject({ shortDescription: copy.short, source: 'ai' });
    expect(
      (await db.select().from(aiDrafts).where(eq(aiDrafts.id, draft.draftId)))[0]!.status,
    ).toBe('applied');
  });
});

describe('детерминированный режим без LLM', () => {
  it('нет ключа: консультант подбирает сборки по бюджету из текста', async () => {
    const { types, ui, text } = await run(
      new ScriptedGateway([], 'x', false),
      'Игровой ПК до 15 млн сум',
    );
    expect(types).toContain('fallback');
    expect(ui.filter((u) => u.kind === 'build').length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/15\s000\s000/u);
    const [runRow] = await db.select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(1);
    expect(runRow).toMatchObject({ deterministic: 'unavailable', model: null });
  });

  it('модель упала до ответа — тот же ход отвечает детерминированно', async () => {
    const gateway = new ScriptedGateway([
      () => [{ type: 'throw', error: new LlmUnavailableError('failed') }],
    ]);
    const { events, text } = await run(gateway, 'Как вернуть товар?', 'account');
    expect(events).toContainEqual({ type: 'fallback', reason: 'failed' });
    expect(text).toContain('10 дней');
  });

  it('проверка сборки без LLM: ошибки совместимости и баланс; поддержка находит свой заказ по телефону', async () => {
    const am5 = snapshot.products.find(
      (p) => p.componentType === 'cpu' && (p.specs as { socket: string }).socket === 'AM5',
    )!;
    const lga = snapshot.products.find(
      (p) =>
        p.componentType === 'motherboard' && (p.specs as { socket: string }).socket === 'LGA1700',
    )!;
    const review = await run(new ScriptedGateway([], 'x', false), 'Проверь', 'review', guest, {
      buildItems: [
        { slug: am5.slug, qty: 1 },
        { slug: lga.slug, qty: 1 },
      ],
    });
    expect(review.text).toContain('AM5');
    const order = await run(
      new ScriptedGateway([], 'x', false),
      `Заказ ${otherOrderNumber}, телефон 93 555 44 33`,
      'account',
    );
    expect(order.text).toContain(otherOrderNumber);
    const denied = await run(
      new ScriptedGateway([], 'x', false),
      `Заказ ${otherOrderNumber}`,
      'account',
    );
    expect(denied.text).toContain('не найден');
  });

  it('AI выключен в настройках и исчерпан дневной бюджет токенов', async () => {
    await updateAiSettings(db, { ...DEFAULT_AI_SETTINGS, enabled: false });
    const off = await run(new ScriptedGateway([say('LLM')]), 'Привет');
    expect(off.events).toContainEqual({ type: 'fallback', reason: 'disabled' });
    await updateAiSettings(db, { ...DEFAULT_AI_SETTINGS, dailyTokensGuest: 1000 });
    await recordRun(db, { agent: 'consultant', guestToken: guest.guestToken, inputTokens: 1500 });
    const budget = await run(new ScriptedGateway([say('LLM')]), 'Привет');
    expect(budget.events).toContainEqual({ type: 'fallback', reason: 'budget' });
    await updateAiSettings(db, DEFAULT_AI_SETTINGS);
  });
});

describe('шлюз Gemini: повторы, фолбэк моделей, circuit breaker', () => {
  function fakeClient(plan: Record<string, (Error | 'ok')[]>) {
    const calls: string[] = [];
    const client = {
      models: {
        generateContentStream: async ({ model }: { model: string }) => {
          calls.push(model);
          const outcome = plan[model]?.shift() ?? 'ok';
          if (outcome !== 'ok') throw outcome;
          return (async function* () {
            yield {
              candidates: [
                {
                  content: {
                    parts: [
                      { text: 'Привет' },
                      { functionCall: { name: 'search_products', args: { query: 'x' } } },
                    ],
                  },
                },
              ],
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
            };
          })();
        },
      },
    };
    return { client, calls };
  }
  const models = { chat: 'chat-m', power: 'power-m', lite: 'lite-m' };
  const request: LlmRequest = {
    tier: 'chat',
    system: 's',
    messages: [{ role: 'user', parts: [{ kind: 'text', text: 'hi' }] }],
  };
  const collect = async (gateway: GeminiGateway) => {
    const out = [];
    for await (const e of gateway.stream(request)) out.push(e);
    return out;
  };

  it('429 → два повтора, затем следующая модель цепочки; события и usage', async () => {
    const { client, calls } = fakeClient({
      'chat-m': [
        new ApiError({ message: 'rate', status: 429 }),
        new ApiError({ message: 'rate', status: 429 }),
        new ApiError({ message: 'rate', status: 429 }),
      ],
    });
    const gateway = new GeminiGateway({
      apiKey: 'k',
      models,
      middle: 'mid-m',
      client: client as never,
      sleep: async () => {},
    });
    const events = await collect(gateway);
    expect(calls).toEqual(['chat-m', 'chat-m', 'chat-m', 'mid-m']);
    expect(events).toEqual([
      { type: 'text', text: 'Привет' },
      { type: 'call', call: { id: 'call-0', name: 'search_products', args: { query: 'x' } } },
      {
        type: 'done',
        model: 'mid-m',
        fallbackFrom: 'chat-m',
        usage: { input: 10, output: 5, thought: 0, cached: 0 },
      },
    ]);
  });

  it('400 — без повторов сразу следующая модель; вся цепочка упала — breaker на 60 с', async () => {
    let now = 0;
    const breaker = new CircuitBreaker(60_000, () => now);
    const bad = () => new ApiError({ message: 'bad', status: 400 });
    const { client, calls } = fakeClient({
      'chat-m': [bad()],
      'mid-m': [bad()],
      'lite-m': [bad()],
    });
    const gateway = new GeminiGateway({
      apiKey: 'k',
      models,
      middle: 'mid-m',
      client: client as never,
      breaker,
      sleep: async () => {},
    });
    await expect(collect(gateway)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(calls).toEqual(['chat-m', 'mid-m', 'lite-m']);
    expect(gateway.available()).toBe(false);
    now = 61_000;
    expect(gateway.available()).toBe(true);
    expect(new GeminiGateway({ apiKey: undefined, models }).available()).toBe(false);
    expect(gateway.chain('power')).toEqual(['power-m', 'chat-m']);
  });

  it('модель молчит — общий лимит вызова, а не таймаут функции Vercel', async () => {
    const started: string[] = [];
    // Ответ не приходит никогда: попытку обрывает только abortSignal
    const hanging = {
      generateContentStream: ({
        model,
        config,
      }: {
        model: string;
        config: { abortSignal: AbortSignal };
      }) => {
        started.push(model);
        return new Promise((_, reject) =>
          config.abortSignal.addEventListener('abort', () => reject(config.abortSignal.reason)),
        );
      },
    };
    const gateway = new GeminiGateway({
      apiKey: 'k',
      models,
      middle: 'mid-m',
      client: { models: hanging } as never,
      timeoutMs: 100,
      deadlineMs: 2_400,
      sleep: async () => {},
    });
    const t0 = Date.now();
    await expect(collect(gateway)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(started.length).toBeGreaterThan(0);
  });
});

describe('мелочи', () => {
  it('разбор бюджета, назначения и интента', () => {
    expect(parseBudget('до 15 млн сум')).toBe(15_000_000);
    expect(parseBudget('бюджет 12 500 000')).toBe(12_500_000);
    expect(parseBudget('25 mln soʻm')).toBe(25_000_000);
    expect(parseBudget('привет')).toBeNull();
    expect(parsePurpose('для монтажа видео')).toBe('workstation');
    expect(parsePurpose('для CS2 на 240 Гц')).toBe('esports');
    expect(classifyByKeywords('Где заказ RC-2026-000001?')).toBe('support');
    expect(classifyByKeywords('Проверь совместимость')).toBe('reviewer');
    expect(classifyByKeywords('Нужна видеокарта')).toBe('consultant');
    expect(classifyByKeywords('Как вернуть товар?')).toBe('support');
  });

  it('лимит сообщений: 20 за 10 минут, затем отказ с временем ожидания', async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(() => now);
    for (let i = 0; i < 20; i++) expect((await limiter.limit('ip', 20, 600_000)).ok).toBe(true);
    const blocked = await limiter.limit('ip', 20, 600_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(600_000);
    now = 600_001;
    expect((await limiter.limit('ip', 20, 600_000)).ok).toBe(true);
  });
});
