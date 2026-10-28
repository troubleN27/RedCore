'use client';

import { localeNames, locales } from '@redcore/i18n';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

export function ProfileForm({
  initial,
}: {
  initial: { name: string; email: string | null; phone: string | null; locale: string };
}) {
  const t = useTranslations('account.profile');
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [lang, setLang] = useState(initial.locale);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-lg space-y-4 rounded-2xl border border-graphite-800 bg-graphite-900/60 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          // locale — дополнительное поле пользователя (язык писем и SMS)
          const result = await authClient.updateUser({ name: name.trim(), locale: lang } as {
            name: string;
          });
          if (!result.error) {
            toast.success(t('saved'));
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">{t('name')}</Label>
        <Input
          id="pf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-phone">{t('phone')}</Label>
        <Input id="pf-phone" value={initial.phone ?? ''} readOnly disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-email">{t('email')}</Label>
        <Input
          id="pf-email"
          value={initial.email ?? ''}
          placeholder={t('emailTemp')}
          readOnly
          disabled
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-lang">{t('language')}</Label>
        <select
          id="pf-lang"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-graphite-900 px-3 text-sm"
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {localeNames[l]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {t('save')}
      </Button>
    </form>
  );
}
