import { telegramConfig } from '@redcore/services';
import { mockPaymentsEnabled } from './payments';

/**
 * Ящик /dev/inbox: сообщения Telegram, которые не ушли в Bot API (бот без токена). В dev —
 * всегда; на продакшене — только на демо-стенде (мок-оплата или DEMO_INBOX=1).
 */
export function devInboxEnabled(): boolean {
  if (telegramConfig().token) return false;
  return (
    process.env.NODE_ENV !== 'production' || mockPaymentsEnabled() || process.env.DEMO_INBOX === '1'
  );
}
