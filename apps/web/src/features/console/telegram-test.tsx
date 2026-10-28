'use client';

import { SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendTelegramTestAction } from '@/server/console-actions';

export function TelegramTestButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('console.settings.telegram');
  const tc = useTranslations('console.common');
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={disabled || pending}
      data-testid="telegram-test"
      onClick={() =>
        startTransition(async () => {
          const result = await sendTelegramTestAction();
          if (result.ok) toast.success(t('sent'));
          else toast.error(tc('error'));
        })
      }
    >
      <SendIcon />
      {t('test')}
    </Button>
  );
}
