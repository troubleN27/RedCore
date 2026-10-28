import type { McpServer } from '@modelcontextprotocol/server';
import { logToolCall } from '@redcore/services';
import type { z } from 'zod';
import { hasScope, type ApiScope, type McpContext } from './context';

/** Ошибка, которую видит клиент: код и понятное сообщение, без стека и внутренностей. */
export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ToolSpec<S extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  /** Достаточно любого из перечисленных scopes */
  scopes: ApiScope[];
  inputSchema: S;
  /** Только чтение — подсказка клиенту, что вызов безопасен */
  readOnly?: boolean;
  destructive?: boolean;
}

const json = (data: unknown) => JSON.stringify(data, null, 0);

/**
 * Регистрирует инструмент, только если у контекста есть нужный scope: клиент без прав не видит
 * инструмент в listTools вовсе. Каждый вызов пишется в ai_tool_calls (PII маскируется).
 */
export function defineTool<S extends z.ZodObject>(
  server: McpServer,
  ctx: McpContext,
  spec: ToolSpec<S>,
  handler: (args: z.infer<S>) => Promise<unknown>,
): void {
  if (!hasScope(ctx, ...spec.scopes)) return;
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      annotations: {
        title: spec.title,
        readOnlyHint: spec.readOnly ?? false,
        destructiveHint: spec.destructive ?? false,
        openWorldHint: false,
      },
    },
    // SDK валидирует аргументы по inputSchema до вызова — сюда приходят уже проверенные
    (async (args: z.infer<S>) => {
      const started = performance.now();
      let ok = true;
      let error: string | null = null;
      let text: string;
      try {
        text = json(await handler(args));
      } catch (err) {
        ok = false;
        if (err instanceof ToolError) {
          error = err.code;
          text = json({ error: err.code, message: err.message });
        } else {
          error = 'internal';
          console.error(`[mcp] ${spec.name} failed`, err);
          text = json({ error: 'internal', message: 'Internal error' });
        }
      }
      await logToolCall(ctx.db, {
        source: ctx.source,
        transport: ctx.transport,
        tool: spec.name,
        args,
        ok,
        error,
        resultPreview: text,
        durationMs: performance.now() - started,
        apiKeyId: ctx.actor.apiKeyId,
        userId: ctx.actor.userId,
        runId: ctx.runId ?? null,
      }).catch((err: unknown) => console.error('[mcp] tool call log failed', err));
      return { content: [{ type: 'text' as const, text }], ...(ok ? {} : { isError: true }) };
    }) as never,
  );
}
