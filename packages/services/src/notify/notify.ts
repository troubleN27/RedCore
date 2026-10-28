import { devOutbox, type Database } from '@redcore/db';
import { desc, eq } from 'drizzle-orm';

// Dev-ящик: без токена бота сообщения Telegram пишутся в таблицу dev_outbox и видны на
// странице /dev/inbox (и в консоли сервера).

export async function listOutbox(db: Database, limit = 50) {
  return db
    .select()
    .from(devOutbox)
    .where(eq(devOutbox.channel, 'telegram'))
    .orderBy(desc(devOutbox.createdAt))
    .limit(limit);
}
