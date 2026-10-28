import type { Client } from '@modelcontextprotocol/client';
import { formatPrice, type Locale } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import { emptyUsage } from '../gateway/types';
import type { AgentContext } from './definitions';
import type { AgentEvent, AgentName, UiPayload } from './events';
import type { RunOutcome } from './run';
import { runUiTool, type UiToolContext } from './ui-tools';

// Детерминированный режим (план, §8 «Фолбэк»): сайт работает и без Gemini. Тот же набор
// инструментов MCP, но вместо модели — разбор запроса по шаблонам и ответы по словарю.

type T = (key: string, params?: Record<string, unknown>) => string;

export interface FallbackOptions {
  agent: AgentName;
  mcp: Client;
  message: string;
  locale: Locale;
  context: AgentContext;
  ui: UiToolContext;
}

async function callJson<R>(
  mcp: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; data: R }> {
  const response = (await mcp.callTool({ name, arguments: args })) as {
    content: { text?: string }[];
    isError?: boolean;
  };
  return {
    ok: response.isError !== true,
    data: JSON.parse(response.content[0]?.text ?? 'null') as R,
  };
}

/** «15 млн», «15 000 000», «15mln», «25 миллионов» → сумы. */
export function parseBudget(text: string): number | null {
  const short = /(\d+(?:[.,]\d+)?)\s*(?:млн|миллион\w*|mln|million|m\b)/iu.exec(text);
  if (short) return Math.round(Number(short[1]!.replace(',', '.')) * 1_000_000);
  const full = /(\d{1,3}(?:[\s\u00a0]\d{3}){2,}|\d{7,})/u.exec(text);
  return full ? Number(full[1]!.replace(/\D/g, '')) : null;
}

export function parsePurpose(text: string): 'gaming' | 'esports' | 'workstation' | 'office' {
  if (/монтаж|работ|рендер|стрим|montaj|ish uchun|render|stream/iu.test(text)) return 'workstation';
  if (/офис|ofis|office|учёб|учеб|o.qish/iu.test(text)) return 'office';
  if (/киберспорт|kibersport|cs2|counter|valorant|dota|240|esport/iu.test(text)) return 'esports';
  return 'gaming';
}

const ORDER = /RC-\d{4}-\d{6}/i;
const PHONE = /(?:\+?998)?[\s(-]*\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;

export async function* runFallback(
  options: FallbackOptions,
): AsyncGenerator<AgentEvent, RunOutcome> {
  const t = getTranslator(options.locale) as unknown as T;
  const ui: UiPayload[] = [];
  const lines: string[] = [];
  const say = (text: string) => lines.push(text);
  const show = (payload: UiPayload) => ui.push(payload);
  const { mcp, message, context } = options;

  switch (options.agent) {
    case 'consultant': {
      const budget = parseBudget(message);
      if (!budget) {
        say(t('ai.fallback.askBudget'));
        break;
      }
      const { data } = await callJson<
        Record<string, { items: { slug: string; qty: number }[] } | null>
      >(mcp, 'generate_builds', {
        budgetUzs: Math.min(Math.max(budget, 3_000_000), 500_000_000),
        purpose: parsePurpose(message),
      });
      for (const key of ['cheaper', 'balanced', 'stronger'] as const) {
        const variant = data?.[key];
        if (!variant) continue;
        const result = await runUiTool(
          'propose_build',
          { title: t(`ai.fallback.titles.${key}`), items: variant.items },
          options.ui,
        );
        if (result.ok && result.ui) show(result.ui);
      }
      say(
        ui.length > 0
          ? t('ai.fallback.builds', { budget: formatPrice(budget, options.locale) })
          : t('ai.fallback.noBuilds', { budget: formatPrice(budget, options.locale) }),
      );
      break;
    }
    case 'reviewer': {
      if (!context.buildItems?.length) {
        say(t('ai.fallback.review.empty'));
        break;
      }
      const check = await callJson<{ issues: { message: string; severity: string }[] }>(
        mcp,
        'check_compatibility',
        {
          items: context.buildItems,
        },
      );
      const analysis = await callJson<{ message: string }[]>(mcp, 'analyze_build', {
        items: context.buildItems,
      });
      const found = [
        ...(check.data?.issues ?? []).filter((i) => i.severity !== 'info').map((i) => i.message),
        ...(analysis.ok ? analysis.data : []).map((f) => f.message),
      ];
      say(
        found.length === 0
          ? t('ai.fallback.review.ok')
          : [t('ai.fallback.review.found'), ...found.map((f) => `• ${f}`)].join('\n'),
      );
      break;
    }
    case 'support': {
      const number = ORDER.exec(message)?.[0]?.toUpperCase() ?? context.orderNumber;
      const topic = /достав|yetkaz|delivery/iu.test(message)
        ? 'delivery'
        : /гарант|kafolat|warranty/iu.test(message)
          ? 'warranty'
          : /возврат|вернуть|qaytar|return/iu.test(message)
            ? 'returns'
            : /оплат|toʻlov|to'lov|payment/iu.test(message)
              ? 'payment'
              : null;
      if (number) {
        const phone = PHONE.exec(message.replace(ORDER, ''))?.[0];
        const order = await callJson<{ number: string; status: string; total: string }>(
          mcp,
          'get_order_status',
          {
            number,
            ...(phone ? { phone } : {}),
          },
        );
        say(
          order.ok
            ? t('ai.fallback.support.order', {
                number: order.data.number,
                status: t(`order.status.${order.data.status}`),
                total: order.data.total,
              })
            : t('ai.fallback.support.orderNotFound'),
        );
      } else if (topic) {
        const policy = await callJson<{ title: string; text: string }>(mcp, 'get_policy', {
          topic,
        });
        say(`${policy.data.title}. ${policy.data.text}`);
      } else if (context.signedIn && /заказ|buyurtma|order/iu.test(message)) {
        const list = await callJson<{ number: string; status: string; total: string }[]>(
          mcp,
          'get_my_orders',
          {},
        );
        say(
          list.ok && list.data.length > 0
            ? [
                t('ai.fallback.support.myOrders'),
                ...list.data
                  .slice(0, 5)
                  .map((o) => `• ${o.number} — ${t(`order.status.${o.status}`)}, ${o.total}`),
              ].join('\n')
            : t('ai.fallback.support.noOrders'),
        );
      } else say(t('ai.fallback.support.intro'));
      break;
    }
    case 'admin': {
      const report = await callJson<{
        revenue: string;
        orders: number;
        averageOrder: string;
        daily: { day: string; revenueUzs: number }[];
      }>(mcp, 'sales_report', { period: 'd7' });
      if (report.ok) {
        say(
          t('ai.fallback.admin', {
            revenue: report.data.revenue,
            orders: report.data.orders,
            aov: report.data.averageOrder,
          }),
        );
        show({
          kind: 'chart',
          title: 'sales_report',
          unit: 'uzs',
          series: report.data.daily.map((d) => ({ label: d.day.slice(5), value: d.revenueUzs })),
        });
      }
      break;
    }
  }

  const text = lines.join('\n\n');
  for (const payload of ui) yield { type: 'ui', ui: payload };
  yield { type: 'text-delta', text };
  return {
    text,
    ui,
    usage: emptyUsage(),
    model: null,
    fallbackFrom: null,
    steps: 0,
    guardRetried: false,
    handoff: null,
  };
}
