import { getDb } from '@redcore/db';
import { createMcpHttpEndpoint } from '@redcore/mcp';
import { env } from '@/env';
import { paymentProvider } from '@/server/payments';

// MCP Streamable HTTP (план, §9): внешние клиенты (Cursor, Claude, Inspector) с ключом
// `Authorization: Bearer rc_…` из консоли. Набор инструментов зависит от scopes ключа.

const endpoint = createMcpHttpEndpoint({
  getDb,
  siteUrl: env.NEXT_PUBLIC_SITE_URL,
  cardEnabled: paymentProvider() !== null,
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return endpoint(request);
}

export function GET(request: Request) {
  return endpoint(request);
}

export function DELETE(request: Request) {
  return endpoint(request);
}
