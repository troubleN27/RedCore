import { smsMode } from '@redcore/services';
import { mockPaymentsEnabled } from './payments';

/**
 * Ящик /dev/inbox: SMS и сообщения Telegram, которые не ушли провайдерам. В dev — всегда; на
 * продакшене — только на демо-стенде (мок-оплата или DEMO_INBOX=1): без SMS-провайдера коды
 * входа иначе не увидеть.
 */
export function devInboxEnabled(): boolean {
  if (smsMode() !== 'mock') return false;
  return (
    process.env.NODE_ENV !== 'production' || mockPaymentsEnabled() || process.env.DEMO_INBOX === '1'
  );
}
