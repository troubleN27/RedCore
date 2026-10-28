'use client';

import type { AiSettings } from '@redcore/services';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChatPanel } from '@/features/chat/chat-panel';
import { reviewAiDraftAction, updateAiSettingsAction } from '@/server/console-actions';

const CONSOLE = 'console' as const;
const ADMIN = 'admin' as const;
const APPLIED = 'applied' as const;
const REJECTED = 'rejected' as const;

export function AdminAssistant() {
  return <ChatPanel place={CONSOLE} agent={ADMIN} className="h-[32rem]" />;
}

export function DraftReview({ id }: { id: string }) {
  const t = useTranslations('console.ai.drafts');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const decide = (decision: 'applied' | 'rejected') =>
    startTransition(async () => {
      const result = await reviewAiDraftAction(id, decision);
      if (result.ok) router.refresh();
      else toast.error(tc('error'));
    });
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="xs"
        disabled={pending}
        onClick={() => decide(APPLIED)}
        data-testid="draft-apply"
      >
        {t('apply')}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => decide(REJECTED)}
      >
        {t('reject')}
      </Button>
    </div>
  );
}

const NUMBER_FIELDS = [
  'guestPer10Min',
  'userPer10Min',
  'dailyTokensGuest',
  'dailyTokensUser',
  'maxMessageChars',
] as const;

export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const t = useTranslations('console.ai.settings');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-3"
      data-testid="ai-settings"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateAiSettingsAction(values);
          if (result.ok) {
            toast.success(tc('saved'));
            router.refresh();
          } else toast.error(tc('error'));
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={values.enabled}
          onCheckedChange={(checked) => setValues({ ...values, enabled: checked === true })}
          data-testid="ai-enabled"
        />
        {t('enabled')}
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {NUMBER_FIELDS.map((key) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`ai-${key}`}>{t(key)}</Label>
            <Input
              id={`ai-${key}`}
              type="number"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}
