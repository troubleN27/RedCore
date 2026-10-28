import type { Database } from '@redcore/db';
import { findUserIdByLogin } from '@redcore/services';
import { scopePresets, type ApiScope, type McpActor } from './context';

/**
 * Кто работает через stdio. Локальный процесс доверенный (его запускает владелец машины),
 * но права всё равно явные: по умолчанию — как у гостя сайта.
 */
export async function resolveStdioActor(
  db: Database,
  spec: string,
): Promise<{ actor: McpActor; scopes: ApiScope[] }> {
  const base = { apiKeyId: null };
  if (spec === 'admin' || spec === 'manager') {
    return {
      actor: { ...base, kind: 'staff', userId: null, label: `stdio:${spec}` },
      scopes: [...scopePresets[spec]],
    };
  }
  if (spec.startsWith('customer:')) {
    const login = spec.slice('customer:'.length);
    const userId = await findUserIdByLogin(db, login);
    if (!userId) throw new Error(`MCP_STDIO_ACTOR: user ${login} not found`);
    return {
      actor: { ...base, kind: 'user', userId, label: `stdio:${login}` },
      scopes: [...scopePresets.customer],
    };
  }
  if (spec !== 'guest') throw new Error(`MCP_STDIO_ACTOR: unknown value "${spec}"`);
  return {
    actor: { ...base, kind: 'anonymous', userId: null, label: 'stdio:guest' },
    scopes: [...scopePresets.guest],
  };
}
