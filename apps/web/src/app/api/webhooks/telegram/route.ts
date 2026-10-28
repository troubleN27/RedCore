import { webhookCallback } from 'grammy';
import { getTelegramBot, telegramConfig } from '@/server/telegram';

// Вебхук бота: Telegram присылает апдейты с заголовком X-Telegram-Bot-Api-Secret-Token.
// Регистрация: setWebhook url=<сайт>/api/webhooks/telegram secret_token=TELEGRAM_WEBHOOK_SECRET.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let handler: ((request: Request) => Promise<Response>) | undefined;

export async function POST(request: Request) {
  const { webhookSecret } = telegramConfig();
  // Без секрета в продакшене вебхук закрыт: иначе кто угодно мог бы слать боту «апдейты»
  if (!webhookSecret) return new Response('Not found', { status: 404 });
  handler ??= webhookCallback(getTelegramBot(), 'std/http', { secretToken: webhookSecret });
  return handler(request);
}
