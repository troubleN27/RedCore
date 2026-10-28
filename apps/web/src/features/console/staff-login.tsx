'use client';

import { formatDate } from '@redcore/i18n';
import { KeyRoundIcon, ShieldCheckIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  staffConfirmEnrollmentAction,
  staffLoginAction,
  staffStartEnrollmentAction,
  staffVerifyTotpAction,
} from '@/server/console-auth-actions';
import { useConsoleHref } from './console-base';

type Step = 'password' | 'totp' | 'enroll';

function CodeInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="text-center font-mono text-2xl tracking-[0.5em]"
      autoFocus
      data-testid="totp-input"
    />
  );
}

export function StaffLogin({ initialStep }: { initialStep: Step }) {
  const t = useTranslations('console.login');
  const locale = useLocale();
  const router = useRouter();
  const href = useConsoleHref();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<{
    qr: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = () => {
    router.replace(href('/'));
    router.refresh();
  };

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await staffLoginAction({ email, password });
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
      setStep(result.status);
    });
  }

  function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await staffVerifyTotpAction(code);
      if (result.ok) done();
      else {
        setCode('');
        setError(t('errors.totp'));
      }
    });
  }

  function startEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await staffStartEnrollmentAction(password);
      if (!result.ok) {
        setError(t('errors.enroll'));
        return;
      }
      const secret = new URL(result.totpURI).searchParams.get('secret') ?? '';
      setEnrollment({ qr: result.qr, secret, backupCodes: result.backupCodes });
    });
  }

  function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await staffConfirmEnrollmentAction(code);
      if (result.ok) done();
      else {
        setCode('');
        setError(t('errors.totp'));
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div
        className="space-y-6 rounded-2xl border border-white/10 bg-graphite-950/80 p-6 shadow-panel sm:p-8"
        data-testid="staff-login"
      >
        <Logo />
        {step === 'password' && (
          <form className="space-y-4" onSubmit={submitPassword}>
            <header className="space-y-1">
              <h1 className="font-display text-xl font-bold">{t('title')}</h1>
              <p className="text-sm text-steel-300">{t('subtitle')}</p>
            </header>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">{t('email')}</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
        )}

        {step === 'totp' && (
          <form className="space-y-4" onSubmit={submitTotp}>
            <header className="space-y-1">
              <h1 className="flex items-center gap-2 font-display text-xl font-bold">
                <ShieldCheckIcon className="size-5 text-brand-bright" />
                {t('totpTitle')}
              </h1>
              <p className="text-sm text-steel-300">{t('totpHint')}</p>
            </header>
            <Label htmlFor="staff-totp">{t('totpLabel')}</Label>
            <CodeInput id="staff-totp" value={code} onChange={setCode} />
            <Button
              type="submit"
              className="w-full"
              disabled={pending || code.length !== 6}
              data-testid="totp-submit"
            >
              {t('verify')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep('password')}
            >
              {t('back')}
            </Button>
          </form>
        )}

        {step === 'enroll' && (
          <div className="space-y-4" data-testid="enroll">
            <header className="space-y-1">
              <h1 className="flex items-center gap-2 font-display text-xl font-bold">
                <KeyRoundIcon className="size-5 text-brand-bright" />
                {t('enrollTitle')}
              </h1>
              <p className="text-sm text-steel-300">{t('enrollHint')}</p>
            </header>
            {!enrollment ? (
              <form className="space-y-3" onSubmit={startEnrollment}>
                <Label htmlFor="enroll-password">{t('enrollPassword')}</Label>
                <Input
                  id="enroll-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending}
                  data-testid="enroll-start"
                >
                  {t('enrollStart')}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={confirmEnrollment}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR приходит data-URL'ом с сервера */}
                <img
                  src={enrollment.qr}
                  alt={t('enrollTitle')}
                  width={220}
                  height={220}
                  className="mx-auto rounded-lg"
                />
                <div className="space-y-1">
                  <p className="text-xs text-steel-400">{t('secretLabel')}</p>
                  <code
                    className="block rounded bg-graphite-900 px-3 py-2 font-mono text-sm break-all"
                    data-testid="totp-secret"
                  >
                    {enrollment.secret}
                  </code>
                </div>
                <details className="text-xs text-steel-300">
                  <summary className="cursor-pointer">{t('backupTitle')}</summary>
                  <p className="mt-2">{t('backupHint')}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
                    {enrollment.backupCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </details>
                <Label htmlFor="enroll-code">{t('totpLabel')}</Label>
                <CodeInput id="enroll-code" value={code} onChange={setCode} />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || code.length !== 6}
                  data-testid="enroll-confirm"
                >
                  {t('enrollConfirm')}
                </Button>
              </form>
            )}
          </div>
        )}

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
