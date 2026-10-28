'use client';

import { CheckCircle2Icon, SendIcon, XCircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import {
  cancelOrderAction,
  confirmDraftOrderAction,
  telegramLinkAction,
} from '@/server/shop-actions';

export function ConfirmDraftButton({ number, token }: { number: string; token: string | null }) {
  const t = useTranslations('order.draft');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      data-testid="confirm-draft"
      onClick={() =>
        startTransition(async () => {
          const result = await confirmDraftOrderAction(number, token);
          if (result.ok) toast.success(t('done'));
          else toast.error(t(`errors.${result.error}`));
          router.refresh();
        })
      }
    >
      <CheckCircle2Icon />
      {t('confirm')}
    </Button>
  );
}

export function CancelOrderButton({ number, token }: { number: string; token: string | null }) {
  const t = useTranslations('order.cancel');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      data-testid="cancel-order"
      onClick={() => {
        if (!window.confirm(t('confirm'))) return;
        startTransition(async () => {
          const result = await cancelOrderAction(number, token);
          if (result.ok) toast.success(t('done'));
          router.refresh();
        });
      }}
    >
      <XCircleIcon />
      {t('button')}
    </Button>
  );
}

const NEW_TAB = '_blank';
const NO_OPENER = 'noopener';

/** Подписка на статусы заказа в Telegram: deep-link открывает бота с одноразовым токеном. */
export function TelegramSubscribe({ number, token }: { number: string; token: string | null }) {
  const t = useTranslations('order.telegram');
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1" data-testid="telegram-subscribe">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        data-testid="telegram-link"
        onClick={() =>
          startTransition(async () => {
            const result = await telegramLinkAction(number, token);
            if (!result.ok) {
              toast.error(t('failed'));
              return;
            }
            window.open(result.url, NEW_TAB, NO_OPENER);
          })
        }
      >
        <SendIcon />
        {t('button')}
      </Button>
      <p className="text-xs text-steel-400">{t('hint')}</p>
    </div>
  );
}
