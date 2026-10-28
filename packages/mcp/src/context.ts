import type { Database } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { apiScopes, type ApiScope } from '@redcore/services';

export { apiScopes, type ApiScope };

/**
 * Кто вызывает инструменты. Права проверяет сам инструмент по actor из замыкания —
 * модель или внешний клиент не могут их расширить (план, §8 «Гарантии и безопасность»).
 */
export interface McpActor {
  kind: 'anonymous' | 'user' | 'staff' | 'api_key' | 'system';
  /** Пользователь, от имени которого работают scopes «:own» */
  userId: string | null;
  /** id ключа — для журнала вызовов */
  apiKeyId: string | null;
  /** Подпись в журнале: email, имя ключа, «stdio» */
  label: string;
}

export interface McpContext {
  db: Database;
  actor: McpActor;
  scopes: ReadonlySet<ApiScope>;
  locale: Locale;
  /** Кто подключён: агент магазина (этап 10) или внешний MCP-клиент */
  source: 'agent' | 'mcp_external';
  transport: 'in-memory' | 'http' | 'stdio';
  /** Адрес сайта для ссылок на заказы и сборки */
  siteUrl: string;
  /** Оплата картой включена (есть Stripe или мок-шлюз) */
  cardEnabled: boolean;
  /** Запуск агента — связывает вызовы в журнале (этап 10) */
  runId?: string | null;
}

/** Наборы scopes по ролям: гость сайта, покупатель, персонал. */
export const scopePresets = {
  guest: ['catalog:read', 'builds:read', 'orders:read:own', 'orders:write:own', 'support:write'],
  customer: ['catalog:read', 'builds:read', 'orders:read:own', 'orders:write:own', 'support:write'],
  manager: [
    'catalog:read',
    'builds:read',
    'orders:read',
    'orders:write',
    'stock:read',
    'stock:write',
    'analytics:read',
    'support:write',
  ],
  admin: [...apiScopes],
} as const satisfies Record<string, readonly ApiScope[]>;

export function hasScope(ctx: McpContext, ...any: ApiScope[]): boolean {
  return any.some((scope) => ctx.scopes.has(scope));
}
