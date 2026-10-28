'use client';

import { formatDate } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staffLoginAction } from '@/server/console-auth-actions';
import { useConsoleHref } from './console-base';

const NO_AUTOCAPITALIZE = 'none';

export function StaffLogin() {
  const t = useTranslations('console.login');
  const locale = useLocale();
  const router = useRouter();
  const href = useConsoleHref();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await staffLoginAction({ login, password });
      if (result.status === 'error') {
        setError(
          result.error === 'locked' && result.until
            ? t('errors.locked', {
                time: formatDate(result.until, locale, { hour: '2-digit', minute: '2-digit' }),
              })
            : t('errors.invalid'),
        );
        return;
      }
      router.replace(href('/'));
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div
        className="space-y-6 rounded-2xl border border-white/10 bg-graphite-950/80 p-6 shadow-panel sm:p-8"
        data-testid="staff-login"
      >
        <Logo />
        <form className="space-y-4" onSubmit={submit}>
          <header className="space-y-1">
            <h1 className="font-display text-xl font-bold">{t('title')}</h1>
            <p className="text-sm text-steel-300">{t('subtitle')}</p>
          </header>
          <div className="space-y-1.5">
            <Label htmlFor="staff-username">{t('login')}</Label>
            <Input
              id="staff-username"
              autoComplete="username"
              autoCapitalize={NO_AUTOCAPITALIZE}
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">{t('password')}</Label>
            <Input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending} data-testid="staff-submit">
            {pending ? t('submitting') : t('submit')}
          </Button>
        </form>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            data-testid="staff-error"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
