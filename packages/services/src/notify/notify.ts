import { devOutbox, type Database } from '@redcore/db';
import { desc } from 'drizzle-orm';

// Письма и SMS. Без ключей провайдеров (dev, демо) сообщения пишутся в таблицу dev_outbox —
// их видно на странице /dev/inbox — и дублируются в консоль сервера.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmsMessage {
  to: string;
  text: string;
}

export function emailMode(): 'resend' | 'mock' {
  return process.env.RESEND_API_KEY ? 'resend' : 'mock';
}

export function smsMode(): 'mock' {
  // Реальный провайдер (Eskiz.uz / Play Mobile) подключается здесь же по SMS_PROVIDER
  return 'mock';
}

export async function sendEmail(db: Database, message: EmailMessage): Promise<void> {
  if (emailMode() === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'RedCore <noreply@example.com>',
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return;
  }
  await db.insert(devOutbox).values({ channel: 'email', ...message });
  console.info(`[dev-inbox] email → ${message.to}: ${message.subject}`);
}

export async function sendSms(db: Database, message: SmsMessage): Promise<void> {
  await db.insert(devOutbox).values({ channel: 'sms', to: message.to, text: message.text });
  console.info(`[dev-inbox] sms → ${message.to}: ${message.text}`);
}

export async function listOutbox(db: Database, limit = 50) {
  return db.select().from(devOutbox).orderBy(desc(devOutbox.createdAt)).limit(limit);
}
