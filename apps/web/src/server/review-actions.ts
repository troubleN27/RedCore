'use server';

import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { submitReview } from '@redcore/services';
import { getSession } from './auth';

/** Отзыв покупателя: только после входа, сразу в очередь модерации консоли. */
export async function submitReviewAction(input: {
  productId: string;
  locale: string;
  rating: number;
  text: string;
  pros?: string;
  cons?: string;
}): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  try {
    await submitReview(await getDb(), {
      ...input,
      locale: isLocale(input.locale) ? input.locale : 'ru',
      userId: session.user.id,
      // Телефон вместо имени не показываем: у новых аккаунтов имя — это номер
      authorName: session.user.name.startsWith('+')
        ? `${session.user.name.slice(0, 7)}…`
        : session.user.name,
      pros: input.pros || undefined,
      cons: input.cons || undefined,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
