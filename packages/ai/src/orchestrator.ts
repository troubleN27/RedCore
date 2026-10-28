import type { Database } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { connectInMemory, scopePresets, type ApiScope, type McpActor } from '@redcore/mcp';
import {
  addMessage,
  conversationHistory,
  getAiSettings,
  getOrCreateConversation,
  recordRun,
  setConversationAgent,
  tokensUsedToday,
  updateRun,
} from '@redcore/services';
import { agents, type AgentContext } from './agents/definitions';
import type { AgentEvent, AgentName, UiPayload } from './agents/events';
import { runFallback } from './agents/fallback';
import { runAgent, type RunOutcome } from './agents/run';
import { costMicros } from './gateway/pricing';
import { LlmUnavailableError, type ChatMessage, type LlmGateway } from './gateway/types';

export type ChatPlace =
  'widget' | 'product' | 'configurator' | 'review' | 'account' | 'order' | 'console';

export interface ChatActor {
  userId: string | null;
  guestToken: string | null;
  role: 'customer' | 'manager' | 'admin' | null;
  label: string;
}

export interface ChatRequest {
  db: Database;
  gateway: LlmGateway;
  place: ChatPlace;
  message: string;
  conversationId?: string | null;
  locale: Locale;
  actor: ChatActor;
  context: Omit<AgentContext, 'signedIn'>;
  siteUrl: string;
  cardEnabled: boolean;
  signal?: AbortSignal;
}

const isStaff = (actor: ChatActor) => actor.role === 'admin' || actor.role === 'manager';

function scopesFor(actor: ChatActor): ApiScope[] {
  if (actor.role === 'admin') return [...scopePresets.admin];
  if (actor.role === 'manager') return [...scopePresets.manager];
  return [...(actor.userId ? scopePresets.customer : scopePresets.guest)];
}

/** Ключевые слова для общего виджета, когда классификатор недоступен. */
export function classifyByKeywords(message: string): AgentName {
  if (
    /RC-\d{4}-\d{6}|заказ|доставк|оплат|гаранти|возврат|верну|вернут|buyurtma|yetkaz|toʻlov|to'lov|kafolat|qaytar/iu.test(
      message,
    )
  )
    return 'support';
  if (/провер|совместим|узкое|горлышк|tekshir|moslik/iu.test(message)) return 'reviewer';
  return 'consultant';
}

/** Интент общего виджета: Flash-Lite со структурированным ответом, при сбое — ключевые слова. */
async function classify(
  gateway: LlmGateway,
  message: string,
  signal?: AbortSignal,
): Promise<AgentName> {
  if (!gateway.available()) return classifyByKeywords(message);
  try {
    let json = '';
    for await (const event of gateway.stream({
      tier: 'lite',
      system:
        'Classify the customer message of a PC hardware store. consultant — choosing parts or a build; ' +
        'reviewer — checking an existing build; support — orders, delivery, payment, warranty, returns.',
      messages: [{ role: 'user', parts: [{ kind: 'text', text: message }] }],
      jsonSchema: {
        type: 'object',
        properties: { agent: { type: 'string', enum: ['consultant', 'reviewer', 'support'] } },
        required: ['agent'],
      },
      signal,
    })) {
      if (event.type === 'text') json += event.text;
    }
    const agent = (JSON.parse(json) as { agent?: string }).agent;
    return agent === 'reviewer' || agent === 'support' ? agent : 'consultant';
  } catch {
    return classifyByKeywords(message);
  }
}

async function pickAgent(request: ChatRequest, current: AgentName | null): Promise<AgentName> {
  if (request.place === 'console') return 'admin';
  if (current && current !== 'admin') return current;
  switch (request.place) {
    case 'configurator':
      return 'consultant';
    case 'review':
      return 'reviewer';
    case 'account':
    case 'order':
      return 'support';
    default:
      return classify(request.gateway, request.message, request.signal);
  }
}

/**
 * Один ход чата: лимиты бюджета, выбор агента, диалог в БД, MCP in-memory с правами
 * пользователя, цикл агента или детерминированный режим, handoff (один раз), журнал запуска.
 */
export async function* chat(request: ChatRequest): AsyncGenerator<AgentEvent> {
  const { db, actor } = request;
  if (request.place === 'console' && !isStaff(actor)) {
    yield { type: 'error', code: 'forbidden' };
    return;
  }
  const settings = await getAiSettings(db);
  let deterministic: string | null = null;
  if (!settings.enabled) deterministic = 'disabled';
  else if (!request.gateway.available()) deterministic = 'unavailable';
  else {
    const used = await tokensUsedToday(db, actor);
    if (used >= (actor.userId ? settings.dailyTokensUser : settings.dailyTokensGuest))
      deterministic = 'budget';
  }

  const existing = request.conversationId
    ? await getOrCreateConversation(db, {
        id: request.conversationId,
        userId: actor.userId,
        guestToken: actor.guestToken,
        agent: 'consultant',
        place: request.place,
        locale: request.locale,
      })
    : null;
  let agentName = await pickAgent(
    request,
    existing && existing.id === request.conversationId ? existing.agent : null,
  );
  const conversation =
    existing && existing.id === request.conversationId
      ? existing
      : await getOrCreateConversation(db, {
          userId: actor.userId,
          guestToken: actor.guestToken,
          agent: agentName,
          place: request.place,
          locale: request.locale,
        });
  if (conversation.agent !== agentName) await setConversationAgent(db, conversation.id, agentName);

  const history: ChatMessage[] = (await conversationHistory(db, conversation.id)).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ kind: 'text', text: m.content || '…' }],
  }));
  await addMessage(db, { conversationId: conversation.id, role: 'user', content: request.message });
  yield { type: 'meta', conversationId: conversation.id, agent: agentName };

  const context: AgentContext = { ...request.context, signedIn: actor.userId !== null };
  const started = performance.now();
  const runId = await recordRun(db, {
    agent: agentName,
    conversationId: conversation.id,
    userId: actor.userId,
    guestToken: actor.userId ? null : actor.guestToken,
    deterministic,
  });
  const mcpActor: McpActor = {
    kind: isStaff(actor) ? 'staff' : actor.userId ? 'user' : 'anonymous',
    userId: actor.userId,
    apiKeyId: null,
    label: actor.label,
  };
  const { client, close } = await connectInMemory({
    db,
    actor: mcpActor,
    scopes: new Set(scopesFor(actor)),
    locale: request.locale,
    source: 'agent',
    siteUrl: request.siteUrl,
    cardEnabled: request.cardEnabled,
    runId,
  });

  let text = '';
  const ui: UiPayload[] = [];
  let error: string | null = null;
  const usage = { input: 0, output: 0, thought: 0, cached: 0 };
  let steps = 0;
  let guardRetried = false;
  let model: string | null = null;
  let fallbackFrom: string | null = null;

  try {
    for (let hop = 0; hop < 2; hop++) {
      const agent = agents[agentName];
      const uiContext = {
        db,
        locale: request.locale,
        userId: actor.userId,
        siteUrl: request.siteUrl,
        allowedHandoff: agent.handoffTo,
      };
      let outcome: RunOutcome;
      let emitted = false;
      if (deterministic) {
        yield { type: 'fallback', reason: deterministic };
        outcome = yield* runFallback({
          agent: agentName,
          mcp: client,
          message: request.message,
          locale: request.locale,
          context,
          ui: uiContext,
        });
      } else {
        try {
          const run = runAgent({
            agent,
            gateway: request.gateway,
            mcp: client,
            history,
            message: request.message,
            locale: request.locale,
            context,
            ui: uiContext,
            signal: request.signal,
          });
          let next = await run.next();
          while (!next.done) {
            if (next.value.type === 'text-delta' || next.value.type === 'ui') emitted = true;
            yield next.value;
            next = await run.next();
          }
          outcome = next.value;
        } catch (err) {
          if (!(err instanceof LlmUnavailableError) || emitted) throw err;
          // Причина отказа модели (ключ, квота, таймаут) — в лог: в ответе покупателю её нет
          if (err.reason !== 'no_key') console.warn('[ai] llm unavailable', err.reason, err.cause);
          deterministic = err.reason === 'no_key' ? 'unavailable' : err.reason;
          yield { type: 'fallback', reason: deterministic };
          outcome = yield* runFallback({
            agent: agentName,
            mcp: client,
            message: request.message,
            locale: request.locale,
            context,
            ui: uiContext,
          });
        }
      }
      text += (text && outcome.text ? '\n\n' : '') + outcome.text;
      ui.push(...outcome.ui);
      for (const key of ['input', 'output', 'thought', 'cached'] as const)
        usage[key] += outcome.usage[key];
      steps += outcome.steps;
      guardRetried ||= outcome.guardRetried;
      model = outcome.model ?? model;
      fallbackFrom ??= outcome.fallbackFrom;

      if (!outcome.handoff || hop === 1) break;
      const to = outcome.handoff.to;
      yield { type: 'handoff', from: agentName, to, reason: outcome.handoff.reason };
      agentName = to;
      await setConversationAgent(db, conversation.id, to);
    }
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : 'failed';
    console.error('[ai] chat failed', err);
    yield { type: 'error', code: 'failed' };
  } finally {
    await close().catch(() => undefined);
  }

  if (text || ui.length > 0) {
    await addMessage(db, {
      conversationId: conversation.id,
      role: 'assistant',
      agent: agentName,
      content: text,
      ui,
    });
  }
  await updateRun(db, runId, {
    agent: agentName,
    model,
    fallbackFrom,
    deterministic,
    steps,
    inputTokens: usage.input,
    outputTokens: usage.output,
    thoughtTokens: usage.thought,
    cachedTokens: usage.cached,
    latencyMs: Math.round(performance.now() - started),
    costUsdMicros: costMicros(model, usage),
    guardRetried,
    error,
  });
  yield { type: 'done', model };
}
