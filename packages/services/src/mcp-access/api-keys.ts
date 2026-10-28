import { aiToolCalls, apiKeys, user, type Database } from '@redcore/db';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AdminValidationError } from '../admin/catalog';

// Доступ внешних MCP-клиентов (план, §9): ключи `rc_…` со scopes и журнал вызовов инструментов.

export { apiScopes, type ApiScope } from './scopes';
import { apiScopes, type ApiScope } from './scopes';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateKey(): string {
  const bytes = randomBytes(32);
  let body = '';
  for (const b of bytes) body += KEY_ALPHABET[b % KEY_ALPHABET.length];
  return `rc_${body}`;
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.enum(apiScopes)).min(1),
  /** Пользователь для scopes «:own» — по почте */
  userEmail: z.email().optional(),
});

/** Новый ключ: значение возвращается один раз, в базе остаётся только хэш. */
export async function createApiKey(
  db: Database,
  input: z.input<typeof createSchema>,
  createdBy: string | null,
) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  let userId: string | null = null;
  if (parsed.data.userEmail) {
    const [owner] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, parsed.data.userEmail));
    if (!owner) throw new AdminValidationError(['userEmail']);
    userId = owner.id;
  }
  const key = generateKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: parsed.data.name,
      prefix: key.slice(0, 11),
      keyHash: hashApiKey(key),
      scopes: [...new Set(parsed.data.scopes)],
      userId,
      createdBy,
    })
    .returning({ id: apiKeys.id, prefix: apiKeys.prefix, scopes: apiKeys.scopes });
  return { ...row!, key };
}

export interface VerifiedApiKey {
  id: string;
  name: string;
  scopes: ApiScope[];
  userId: string | null;
}

/** Проверка Bearer-ключа: не отозван, известные scopes. Время последнего использования — раз в минуту. */
export async function verifyApiKey(db: Database, key: string): Promise<VerifiedApiKey | null> {
  if (!/^rc_[A-Za-z0-9]{20,64}$/.test(key)) return null;
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(apiKeys.id, row.id));
  }
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes.filter((s): s is ApiScope => (apiScopes as readonly string[]).includes(s)),
    userId: row.userId,
  };
}

export async function listApiKeys(db: Database) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      userEmail: user.email,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .leftJoin(user, eq(user.id, apiKeys.userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(db: Database, id: string) {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id, name: apiKeys.name });
  return row ?? null;
}

// ── Журнал вызовов ──

const PHONE = /\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** PII в логах маскируется (план, §8): телефон → +998 ** *** ** 67, почта → a***@domain. */
export function maskPii<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value)
      .replace(PHONE, (m) => `+998 ** *** ** ${m.replace(/\D/g, '').slice(-2)}`)
      .replace(EMAIL, '$1***@$2'),
  ) as T;
}

export interface ToolCallLog {
  source: 'agent' | 'mcp_external';
  transport: 'in-memory' | 'http' | 'stdio';
  tool: string;
  args: unknown;
  ok: boolean;
  error?: string | null;
  resultPreview?: string | null;
  durationMs: number;
  apiKeyId?: string | null;
  userId?: string | null;
  runId?: string | null;
}

export async function logToolCall(db: Database, entry: ToolCallLog): Promise<void> {
  await db.insert(aiToolCalls).values({
    source: entry.source,
    transport: entry.transport,
    tool: entry.tool,
    args: maskPii(entry.args ?? {}) as object,
    ok: entry.ok,
    error: entry.error ?? null,
    resultPreview: entry.resultPreview ? maskPii(entry.resultPreview).slice(0, 500) : null,
    durationMs: Math.round(entry.durationMs),
    apiKeyId: entry.apiKeyId ?? null,
    userId: entry.userId ?? null,
    runId: entry.runId ?? null,
  });
}

export const TOOL_CALLS_PAGE = 50;

export async function listToolCalls(db: Database, filter: { page?: number; tool?: string } = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const where = filter.tool ? eq(aiToolCalls.tool, filter.tool) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: aiToolCalls.id,
        source: aiToolCalls.source,
        transport: aiToolCalls.transport,
        tool: aiToolCalls.tool,
        args: aiToolCalls.args,
        ok: aiToolCalls.ok,
        error: aiToolCalls.error,
        durationMs: aiToolCalls.durationMs,
        createdAt: aiToolCalls.createdAt,
        keyName: apiKeys.name,
      })
      .from(aiToolCalls)
      .leftJoin(apiKeys, eq(apiKeys.id, aiToolCalls.apiKeyId))
      .where(where)
      .orderBy(desc(aiToolCalls.createdAt))
      .limit(TOOL_CALLS_PAGE)
      .offset((page - 1) * TOOL_CALLS_PAGE),
    db.select({ n: count() }).from(aiToolCalls).where(where),
  ]);
  return { rows, total: total?.n ?? 0, page };
}
