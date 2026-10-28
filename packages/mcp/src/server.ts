import { McpServer } from '@modelcontextprotocol/server';
import type { McpContext } from './context';
import { registerPrompts, registerResources } from './resources';
import { registerAgentTools } from './tools/agents';
import { registerBuildTools } from './tools/builds';
import { registerCatalogTools } from './tools/catalog';
import { registerOrderTools } from './tools/orders';
import { registerStockTools } from './tools/stock';

export const SERVER_INFO = { name: 'redcore-shop', version: '1.0.0' } as const;

/**
 * Сервер магазина для одного подключения/запроса. Инструменты регистрируются по scopes
 * контекста, actor живёт в замыкании — один и тот же код обслуживает агентов (in-memory),
 * внешних клиентов по HTTP и Claude Desktop по stdio.
 */
export function createShopMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      'RedCore — PC hardware store in Uzbekistan, prices in UZS. Product facts, prices and stock ' +
      'come only from tools. FPS numbers are estimates. Orders created here are drafts: the ' +
      'customer confirms and pays via the returned link.',
  });
  registerCatalogTools(server, ctx);
  registerBuildTools(server, ctx);
  registerOrderTools(server, ctx);
  registerStockTools(server, ctx);
  registerAgentTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  return server;
}
