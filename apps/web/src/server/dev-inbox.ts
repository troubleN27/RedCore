import { emailMode } from '@redcore/services';
import { mockPaymentsEnabled } from './payments';

/**
 * Ящик /dev/inbox: письма и SMS, которые не ушли провайдерам. В dev — всегда; на продакшене —
 * только на демо-стенде (мок-оплата или DEMO_INBOX=1), иначе без почты коды входа не увидеть.
 */
export function devInboxEnabled(): boolean {
  if (emailMode() !== 'mock') return false;
  return (
    process.env.NODE_ENV !== 'production' || mockPaymentsEnabled() || process.env.DEMO_INBOX === '1'
  );
}
