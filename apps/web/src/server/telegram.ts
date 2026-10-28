import 'server-only';
import { getDb } from '@redcore/db';
import {
  botNotifier,
  createTelegramBot,
  telegramConfig,
  type TelegramNotifier,
} from '@redcore/services';
import type { Bot } from 'grammy';
import { env } from '@/env';
import { adminBasePath } from '@/lib/admin-path';

// Бот на процесс: команды через вебхук и отправка уведомлений. Без TELEGRAM_BOT_TOKEN —
// мок-режим (сообщения в /dev/inbox), с токеном — Bot API.

let bot: Bot | undefined;

export function getTelegramBot(): Bot {
  bot ??= createTelegramBot(getDb);
  return bot;
}

export function getTelegramNotifier(): TelegramNotifier {
  return botNotifier(getTelegramBot());
}

/** Ссылка на заказ в консоли — только если секретный путь задан (в dev — /ops-console-dev). */
export function consoleUrl(): string | null {
  const base = adminBasePath();
  return base ? `${env.NEXT_PUBLIC_SITE_URL}${base}` : null;
}

export { telegramConfig };
