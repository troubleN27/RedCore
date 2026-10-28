import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Как Claude Desktop: отдельный процесс, JSON-RPC по stdin/stdout, логи — в stderr. */
async function spawn(env: Record<string, string>) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/bin/stdio.ts'],
    cwd: root,
    env: { ...(process.env as Record<string, string>), DATABASE_URL: '', ...env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

describe('MCP по stdio', () => {
  it('гость по умолчанию: поиск работает, складских инструментов нет', async () => {
    const client = await spawn({ MCP_STDIO_ACTOR: 'guest' });
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain('check_compatibility');
    expect(names).not.toContain('adjust_stock');
    const result = (await client.callTool({
      name: 'search_products',
      arguments: { query: 'ryzen', limit: 1 },
    })) as { content: { text: string }[] };
    expect(JSON.parse(result.content[0]!.text).items).toHaveLength(1);
    await client.close();
  });

  it('MCP_STDIO_ACTOR=admin — полный набор, MCP_LOCALE=uz — тексты на узбекском', async () => {
    const client = await spawn({ MCP_STDIO_ACTOR: 'admin', MCP_LOCALE: 'uz' });
    expect((await client.listTools()).tools).toHaveLength(21);
    const policy = await client.readResource({ uri: 'policy://returns' });
    expect((policy.contents[0] as { text: string }).text).toContain('Qaytarish');
    await client.close();
  });
});
