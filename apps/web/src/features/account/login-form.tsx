'use client';

import { normalizeUzPhone } from '@redcore/domain';
import { InboxIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

type ErrorKey =
  'invalidPhone' | 'invalidCode' | 'tooManyAttempts' | 'expired' | 'rateLimited' | 'generic';

const RESEND_SECONDS = 60;

function errorKey(error: { status?: number; code?: string } | null): ErrorKey {
  if (!error) return 'generic';
  if (error.status === 429) return 'rateLimited';
  switch (error.code) {
    case 'INVALID_OTP':
      return 'invalidCode';
    case 'OTP_EXPIRED':
    case 'OTP_NOT_FOUND':
      return 'expired';
    case 'TOO_MANY_ATTEMPTS':
      return 'tooManyAttempts';
    case 'INVALID_PHONE_NUMBER':
      return 'invalidPhone';
    default:
      return 'generic';
  }
}

export function LoginForm({ next, showDevInbox }: { next: string; showDevInbox: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<ErrorKey | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function sendCode() {
    const value = normalizeUzPhone(phone);
    if (!value) {
      setError('invalidPhone');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: value });
      if (result.error) {
        setError(errorKey(result.error));
        return;
      }
      setSentTo(value);
      setCode('');
      setCooldown(RESEND_SECONDS);
    });
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!sentTo || code.length !== 6) {
      setError('invalidCode');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await authClient.phoneNumber.verify({ phoneNumber: sentTo, code });
      if (result.error) {
        setError(errorKey(result.error));
        return;
      }
      toast.success(t('welcome'));
      router.replace(next);
      router.refresh();
    });
  }

  const errorText = error ? t(`errors.${error}`) : null;

  return (
    <div className="space-y-5" data-testid="login-form">
      {!sentTo && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <Label htmlFor="login-phone">{t('phoneLabel')}</Label>
          <Input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(error)}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={pending} data-testid="send-code">
            {pending ? t('sending') : t('sendCode')}
          </Button>
        </form>
      )}

      {sentTo && (
        <form className="space-y-3" onSubmit={verify}>
          <p className="text-sm text-steel-300">
            {t('codeSent', { target: sentTo })}{' '}
            <button
              type="button"
              className="text-brand-bright underline underline-offset-2"
              onClick={() => setSentTo(null)}
            >
              {t('change')}
            </button>
          </p>
          <Label htmlFor="login-code">{t('codeLabel')}</Label>
          <Input
            id="login-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center font-mono text-2xl tracking-[0.5em]"
            aria-invalid={Boolean(error)}
            autoFocus
            data-testid="otp-input"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || code.length !== 6}
            data-testid="verify-code"
          >
            {pending ? t('verifying') : t('verify')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={pending || cooldown > 0}
            onClick={sendCode}
          >
            {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
          </Button>
        </form>
      )}

      {errorText && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {errorText}
        </p>
      )}

      {showDevInbox && (
        <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-steel-300">
          <InboxIcon className="mt-0.5 size-4 shrink-0 text-info" />
          <span>
            {t('devHint')}{' '}
            <Link
              href="/dev/inbox"
              target="_blank"
              className="text-info underline underline-offset-2"
            >
              {t('devInbox')}
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}
