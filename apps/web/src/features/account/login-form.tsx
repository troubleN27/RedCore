'use client';

import { formatDate } from '@redcore/i18n';
import { LogInIcon, UserPlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { loginAction, registerAction } from '@/server/account-auth-actions';

type Mode = 'signIn' | 'register';

const MODES = [
  { mode: 'signIn', icon: LogInIcon, testId: 'tab-sign-in' },
  { mode: 'register', icon: UserPlusIcon, testId: 'tab-register' },
] as const;
type ErrorKey =
  | 'invalidPhone'
  | 'invalid'
  | 'locked'
  | 'passwordShort'
  | 'passwordMismatch'
  | 'phoneTaken'
  | 'generic';

/** Совпадает с MIN_PASSWORD_LENGTH на сервере: здесь — только для подсказки и проверки до отправки */
const MIN_PASSWORD = 8;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signIn');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ key: ErrorKey; until?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function switchMode(value: Mode) {
    setMode(value);
    setPassword('');
    setConfirm('');
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === 'register') {
      if (password.length < MIN_PASSWORD) return setError({ key: 'passwordShort' });
      if (password !== confirm) return setError({ key: 'passwordMismatch' });
    }
    startTransition(async () => {
      const result =
        mode === 'register'
          ? await registerAction({ phone, password, confirm, locale })
          : await loginAction({ phone, password });
      if (!result.ok) {
        setError({ key: result.error, until: 'until' in result ? result.until : undefined });
        return;
      }
      // Сессию поставил server action — клиентский useSession перечитывает её
      authClient.$store.notify('$sessionSignal');
      toast.success(t(mode === 'register' ? 'registered' : 'welcome'));
      router.replace(next);
      router.refresh();
    });
  }

  const errorText = error
    ? error.key === 'locked' && error.until
      ? t('errors.locked', {
          time: formatDate(error.until, locale, { hour: '2-digit', minute: '2-digit' }),
        })
      : t(`errors.${error.key}`, { min: MIN_PASSWORD })
    : null;

  return (
    <div className="space-y-5" data-testid="login-form">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-graphite-800 bg-graphite-900 p-1"
        role="group"
        aria-label={t('title')}
      >
        {MODES.map(({ mode: value, icon: Icon, testId }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            data-testid={testId}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors [&_svg]:size-4',
              mode === value ? 'bg-graphite-700 text-white' : 'text-steel-300 hover:text-white',
            )}
          >
            <Icon />
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      <form className="space-y-3" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="login-phone">{t('phoneLabel')}</Label>
          <Input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={error?.key === 'invalidPhone' || error?.key === 'phoneTaken'}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">{t('passwordLabel')}</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === 'register' ? 'login-password-hint' : undefined}
            required
          />
          {mode === 'register' && (
            <p id="login-password-hint" className="text-xs text-steel-400">
              {t('passwordHint', { min: MIN_PASSWORD })}
            </p>
          )}
        </div>
        {mode === 'register' && (
          <div className="space-y-1.5">
            <Label htmlFor="login-confirm">{t('confirmLabel')}</Label>
            <Input
              id="login-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={error?.key === 'passwordMismatch'}
              required
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={pending} data-testid="login-submit">
          {pending ? t('pending') : t(mode === 'register' ? 'submitRegister' : 'submitSignIn')}
        </Button>
      </form>

      {errorText && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          data-testid="login-error"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
