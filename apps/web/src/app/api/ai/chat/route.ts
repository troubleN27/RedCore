import { chat, type ChatPlace } from '@redcore/ai';
import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { getAiSettings } from '@redcore/services';
import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/env';
import { getGateway, getLimiter } from '@/server/ai';
import { getSession } from '@/server/auth';
import { paymentProvider } from '@/server/payments';

// SSE-чат с агентами (план, §8): лимиты → оркестратор → поток типизированных событий.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUEST_COOKIE = 'rc_ai_guest';
const WINDOW_MS = 10 * 60 * 1000;

const bodySchema = z.object({
  message: z.string().trim().min(1),
  place: z.enum(['widget', 'product', 'configurator', 'review', 'account', 'order', 'console']),
  conversationId: z.uuid().nullish(),
  locale: z.string(),
  context: z
    .object({
      buildItems: z
        .array(z.object({ slug: z.string().max(200), qty: z.number().int().min(1).max(8) }))
        .max(30)
        .optional(),
      productSlug: z.string().max(200).optional(),
      orderNumber: z.string().max(20).optional(),
    })
    .default({}),
});

const json = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error: code, ...extra }, { status });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, 'invalid');
  const body = parsed.data;
  const locale = isLocale(body.locale) ? body.locale : 'ru';
  const db = await getDb();
  const settings = await getAiSettings(db);
  if (body.message.length > settings.maxMessageChars)
    return json(400, 'too_long', { max: settings.maxMessageChars });

  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const jar = await cookies();
  let guestToken = jar.get(GUEST_COOKIE)?.value ?? null;
  if (!session && !guestToken) {
    guestToken = randomBytes(18).toString('base64url');
    jar.set(GUEST_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NEXT_PUBLIC_SITE_URL.startsWith('https'),
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
    });
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'local';
  const limit = await getLimiter().limit(
    session ? `user:${session.user.id}` : `ip:${ip}`,
    session ? settings.userPer10Min : settings.guestPer10Min,
    WINDOW_MS,
  );
  if (!limit.ok) return json(429, 'rate_limited', { retryAfterMs: limit.retryAfterMs });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of chat({
          db,
          gateway: getGateway(),
          place: body.place as ChatPlace,
          message: body.message,
          conversationId: body.conversationId ?? null,
          locale,
          actor: {
            userId: session?.user.id ?? null,
            guestToken: session ? null : guestToken,
            role: role === 'admin' || role === 'manager' ? role : session ? 'customer' : null,
            label: session?.user.email ?? `guest:${ip}`,
          },
          context: body.context,
          siteUrl: env.NEXT_PUBLIC_SITE_URL,
          cardEnabled: paymentProvider() !== null,
          signal: request.signal,
        })) {
          send(event);
        }
      } catch (error) {
        console.error('[ai] stream failed', error);
        send({ type: 'error', code: 'failed' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
