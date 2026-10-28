import { devOutbox, type Database } from '@redcore/db';
import { desc } from 'drizzle-orm';

// SMS. Без ключа провайдера (dev, демо) сообщения пишутся в таблицу dev_outbox — их видно
// на странице /dev/inbox — и дублируются в консоль сервера.

export interface SmsMessage {
  to: string;
  text: string;
}

export function smsMode(): 'mock' {
  // Реальный провайдер (Eskiz.uz / Play Mobile) подключается здесь же по SMS_PROVIDER
  return 'mock';
}

export async function sendSms(db: Database, message: SmsMessage): Promise<void> {
  await db.insert(devOutbox).values({ channel: 'sms', to: message.to, text: message.text });
  console.info(`[dev-inbox] sms → ${message.to}: ${message.text}`);
}

export async function listOutbox(db: Database, limit = 50) {
  return db.select().from(devOutbox).orderBy(desc(devOutbox.createdAt)).limit(limit);
}
