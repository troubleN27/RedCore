import type { Client } from '@modelcontextprotocol/client';
import type { Locale } from '@redcore/i18n';
import {
  emptyUsage,
  type ChatMessage,
  type ChatPart,
  type LlmGateway,
  type LlmUsage,
  type ToolDeclaration,
} from '../gateway/types';
import type { AgentContext, AgentDefinition } from './definitions';
import type { AgentEvent, AgentName, UiPayload } from './events';
import { isUiTool, runUiTool, uiToolDeclarations, type UiToolContext } from './ui-tools';

export interface RunOptions {
  agent: AgentDefinition;
  gateway: LlmGateway;
  mcp: Client;
  history: ChatMessage[];
  message: string;
  locale: Locale;
  context: AgentContext;
  ui: UiToolContext;
  signal?: AbortSignal;
}

export interface RunOutcome {
  text: string;
  ui: UiPayload[];
  usage: LlmUsage;
  model: string | null;
  fallbackFrom: string | null;
  steps: number;
  guardRetried: boolean;
  handoff: { to: AgentName; reason: string } | null;
}

const TOOL_RESULT_LIMIT = 20_000;

// ── Guard: суммы в ответе должны встречаться в результатах инструментов ──

const MONEY = /(\d{1,3}(?:[\s\u00a0\u202f.,]\d{3})+|\d{4,})\s*(?:сум|so[ʻ'‘`’]?m|uzs)/giu;
const NUMBERS = /\d+(?:[\s\u00a0\u202f]\d{3})*/gu;
const digits = (s: string) => s.replace(/\D/g, '');

/** Суммы из текста ответа, которых нет ни в одном результате инструментов. */
export function unknownAmounts(text: string, toolTexts: string[]): string[] {
  const known = new Set<string>();
  for (const t of toolTexts) for (const m of t.matchAll(NUMBERS)) known.add(digits(m[0]));
  const missing: string[] = [];
  for (const m of text.matchAll(MONEY)) {
    const value = digits(m[1]!);
    if (!known.has(value)) missing.push(m[0].trim());
  }
  return missing;
}

function correction(missing: string[]): string {
  return (
    `Your previous answer mentioned amounts that are not in any tool result: ${missing.join('; ')}. ` +
    'Rewrite the whole answer using only prices and totals exactly as returned by the tools. Do not apologize.'
  );
}

/**
 * Цикл агента: модель ⇄ инструменты (MCP in-memory и UI), до maxSteps ответов модели.
 * События идут наружу сразу (SSE), итог возвращается из генератора.
 */
export async function* runAgent(options: RunOptions): AsyncGenerator<AgentEvent, RunOutcome> {
  const { agent, gateway, mcp } = options;
  const listed = await mcp.listTools();
  const mcpTools: ToolDeclaration[] = listed.tools
    .filter((t) => agent.tools.includes(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description ?? t.name,
      parameters: t.inputSchema as Record<string, unknown>,
    }));
  const available = new Set(mcpTools.map((t) => t.name));
  const tools = [...mcpTools, ...uiToolDeclarations(agent.uiTools)];
  const system = agent.prompt(options.locale, options.context);

  const messages: ChatMessage[] = [
    ...options.history,
    { role: 'user', parts: [{ kind: 'text', text: options.message }] },
  ];
  const outcome: RunOutcome = {
    text: '',
    ui: [],
    usage: emptyUsage(),
    model: null,
    fallbackFrom: null,
    steps: 0,
    guardRetried: false,
    handoff: null,
  };
  const toolTexts: string[] = [];
  let finalText = '';

  const generate = async function* (withTools: boolean) {
    let text = '';
    const calls: { id: string; name: string; args: Record<string, unknown> }[] = [];
    for await (const event of gateway.stream({
      tier: agent.tier,
      system,
      messages,
      tools: withTools ? tools : undefined,
      thinking: agent.thinking,
      signal: options.signal,
    })) {
      if (event.type === 'text') {
        text += event.text;
        yield { type: 'text-delta', text: event.text } satisfies AgentEvent;
      } else if (event.type === 'call') calls.push(event.call);
      else {
        outcome.model = event.model;
        outcome.fallbackFrom ??= event.fallbackFrom;
        for (const key of ['input', 'output', 'thought', 'cached'] as const)
          outcome.usage[key] += event.usage[key];
      }
    }
    outcome.steps++;
    return { text, calls };
  };

  for (let step = 0; step < agent.maxSteps; step++) {
    const { text, calls } = yield* generate(true);
    finalText += text;
    const modelParts: ChatPart[] = [
      ...(text ? [{ kind: 'text' as const, text }] : []),
      ...calls.map((call) => ({ kind: 'call' as const, call })),
    ];
    messages.push({ role: 'model', parts: modelParts });
    if (calls.length === 0) break;

    const results: ChatPart[] = [];
    for (const call of calls) {
      yield { type: 'tool-start', id: call.id, name: call.name };
      let result: unknown;
      let ok = true;
      if (isUiTool(call.name) && agent.uiTools.includes(call.name)) {
        const r = await runUiTool(call.name, call.args, {
          ...options.ui,
          allowedHandoff: agent.handoffTo,
        });
        ok = r.ok;
        result = r.result;
        if (r.ok && r.ui) {
          outcome.ui.push(r.ui);
          yield { type: 'ui', ui: r.ui };
        }
        if (r.ok && r.handoff) outcome.handoff = r.handoff;
      } else if (available.has(call.name)) {
        const response = (await mcp.callTool({ name: call.name, arguments: call.args })) as {
          content: { type: string; text?: string }[];
          isError?: boolean;
        };
        const text = response.content.map((c) => c.text ?? '').join('\n');
        ok = response.isError !== true;
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      } else {
        ok = false;
        result = { error: 'unknown_tool', message: `Tool ${call.name} is not available` };
      }
      const serialized = JSON.stringify(result);
      toolTexts.push(serialized);
      results.push({
        kind: 'result',
        id: call.id,
        name: call.name,
        result:
          serialized.length > TOOL_RESULT_LIMIT
            ? `${serialized.slice(0, TOOL_RESULT_LIMIT)}…`
            : result,
      });
      yield { type: 'tool-end', id: call.id, name: call.name, ok };
    }
    messages.push({ role: 'user', parts: results });
    if (outcome.handoff) break;
  }

  // Guard: цена в ответе, которой нет в результатах инструментов → один раз переписываем
  const missing = outcome.handoff ? [] : unknownAmounts(finalText, toolTexts);
  if (missing.length > 0) {
    outcome.guardRetried = true;
    yield { type: 'retract' };
    messages.push({ role: 'user', parts: [{ kind: 'text', text: correction(missing) }] });
    const { text } = yield* generate(false);
    finalText = text;
  }
  outcome.text = finalText.trim();
  return outcome;
}
