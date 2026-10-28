// stdout — канал JSON-RPC: любой console.log сломает протокол. Логи базы и сервисов уводим
// в stderr ДО их импорта (поэтому остальное подключается динамически).
console.log = (...args: unknown[]) => console.error(...args);
console.info = (...args: unknown[]) => console.error(...args);

const { serveStdio } = await import('@modelcontextprotocol/server/stdio');
const { getDb } = await import('@redcore/db');
const { isLocale } = await import('@redcore/i18n');
const { resolveStdioActor } = await import('../stdio-actor');
const { createShopMcpServer } = await import('../server');

// pnpm mcp:stdio — локальный сервер для Claude Desktop / Cursor.
// MCP_STDIO_ACTOR: guest (по умолчанию) | customer:<email> | manager | admin
// MCP_LOCALE: ru (по умолчанию) | uz
const db = await getDb();
const actor = await resolveStdioActor(db, process.env.MCP_STDIO_ACTOR ?? 'guest');
const locale =
  process.env.MCP_LOCALE && isLocale(process.env.MCP_LOCALE) ? process.env.MCP_LOCALE : 'ru';

serveStdio(() =>
  createShopMcpServer({
    db,
    actor: actor.actor,
    scopes: new Set(actor.scopes),
    locale,
    source: 'mcp_external',
    transport: 'stdio',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    cardEnabled: true,
  }),
);
console.error(
  `[mcp] RedCore stdio server ready: ${actor.actor.label}, ${actor.scopes.length} scopes, ${locale}`,
);
