import { getDb } from '@redcore/db';
import { handleStripeEvent, invalidateCatalogCache } from '@redcore/services';
import { after } from 'next/server';
import { getGateway, sendOrderNotifications } from '@/server/payments';

export const runtime = 'nodejs';

/**
 * Вебхук Stripe (и мок-шлюза — тот же формат событий и подписи). Тело читаем сырым:
 * подпись считается по байтам запроса. 5xx — Stripe повторит доставку.
 */
export async function POST(request: Request) {
  const gateway = await getGateway();
  if (!gateway) return new Response('Payments disabled', { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });
  const body = await request.text();

  let event;
  try {
    event = gateway.constructEvent(body, signature);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const result = await handleStripeEvent(await getDb(), event);
    if (result.events.length > 0) {
      // Списание или снятие резерва меняет наличие на витрине
      invalidateCatalogCache();
      after(() => sendOrderNotifications(result.events));
    }
    return Response.json({ received: true, status: result.status });
  } catch (error) {
    console.error('stripe webhook failed', event.id, event.type, error);
    return new Response('Webhook handler failed', { status: 500 });
  }
}
