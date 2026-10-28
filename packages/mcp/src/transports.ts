import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import type { Database } from '@redcore/db';
import { isLocale, type Locale } from '@redcore/i18n';
import { verifyApiKey } from '@redcore/services';
import { apiScopes, type ApiScope, type McpContext } from './context';
import { createShopMcpServer, SERVER_INFO } from './server';

// Транспорты (план, §9): in-memory — агенты магазина без сетевого хопа; Streamable HTTP —
// внешние клиенты с Bearer-ключом rc_…; stdio — Claude Desktop и Cursor локально (bin/stdio.ts).

/** Клиент, подключённый к серверу магазина в памяти процесса. Закрывать после запроса. */
export async function connectInMemory(ctx: Omit<McpContext, 'transport'>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createShopMcpServer({ ...ctx, transport: 'in-memory' });
  const client = new Client({ name: `redcore-${ctx.source}`, version: SERVER_INFO.version });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export interface HttpOptions {
  getDb: () => Promise<Database>;
  siteUrl: string;
  cardEnabled: boolean;
}

function localeOf(request: Request): Locale {
  const fromQuery = new URL(request.url).searchParams.get('locale');
  if (fromQuery && isLocale(fromQuery)) return fromQuery;
  return request.headers.get('accept-language')?.toLowerCase().startsWith('uz') ? 'uz' : 'ru';
}

function unauthorized(message: string): Response {
  return Response.json(
    { error: 'unauthorized', message },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="redcore-mcp"' } },
  );
}

/**
 * HTTP-вход для /api/mcp. Ключ проверяется до SDK; scopes и владелец ключа уходят в
 * authInfo, и фабрика собирает сервер ровно с теми инструментами, что разрешены ключу.
 * Обслуживает клиентов спецификации 2026-07-28 и (stateless) 2025 года.
 */
export function createMcpHttpEndpoint(options: HttpOptions) {
  let handler: McpHttpHandler | undefined;
  const getHandler = () =>
    (handler ??= createMcpHandler(
      async ({ authInfo }) => {
        const extra = (authInfo?.extra ?? {}) as {
          userId?: string | null;
          name?: string;
          locale?: Locale;
        };
        return createShopMcpServer({
          db: await options.getDb(),
          actor: {
            kind: 'api_key',
            userId: extra.userId ?? null,
            apiKeyId: authInfo?.clientId ?? null,
            label: extra.name ?? 'api key',
          },
          scopes: new Set((authInfo?.scopes ?? []) as ApiScope[]),
          locale: extra.locale ?? 'ru',
          source: 'mcp_external',
          transport: 'http',
          siteUrl: options.siteUrl,
          cardEnabled: options.cardEnabled,
        });
      },
      { onerror: (error) => console.error('[mcp] http', error) },
    ));

  return async function handle(request: Request): Promise<Response> {
    const header = request.headers.get('authorization') ?? '';
    const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
    if (!token) return unauthorized('Bearer API key required (create one in the console)');
    const key = await verifyApiKey(await options.getDb(), token);
    if (!key) return unauthorized('Invalid or revoked API key');
    return getHandler().fetch(request, {
      authInfo: {
        token: 'redacted',
        clientId: key.id,
        scopes: key.scopes.filter((s) => (apiScopes as readonly string[]).includes(s)),
        extra: { userId: key.userId, name: key.name, locale: localeOf(request) },
      },
    });
  };
}
