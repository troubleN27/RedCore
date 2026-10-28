// Права MCP-ключей. Отдельный модуль без зависимостей — его импортирует и клиентский код консоли.

export const apiScopes = [
  'catalog:read',
  'builds:read',
  'orders:read:own',
  'orders:read',
  'orders:write:own',
  'orders:write',
  'stock:read',
  'stock:write',
  'analytics:read',
  'support:write',
] as const;
export type ApiScope = (typeof apiScopes)[number];
