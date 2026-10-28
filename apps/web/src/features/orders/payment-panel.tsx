'use client';

import { formatDate, formatPrice } from '@redcore/i18n';
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { CreditCardIcon, ShieldAlertIcon, ShieldCheckIcon, TimerIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import { mockPayAction, startPaymentAction, type StartPaymentResult } from '@/server/shop-actions';

const POLL_MS = 2000;

let stripePromise: Promise<Stripe | null> | undefined;
function getStripe(publishableKey: string) {
  stripePromise ??= loadStripe(publishableKey, { locale: 'ru' });
  return stripePromise;
}

/** Ждём вебхук: страница перечитывает статус заказа, пока он не сменится. */
function useAwaitWebhook(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [active, router]);
}

export function PaymentPanel({
  number,
  token,
  totalUzs,
  declineCode,
  publishableKey,
}: {
  number: string;
  token: string | null;
  totalUzs: number;
  /** Код отказа последней попытки (insufficient_funds и т. п.) */
  declineCode: string | null;
  publishableKey: string | null;
}) {
  const t = useTranslations('order.pay');
  const locale = useLocale();
  const [session, setSession] = useState<StartPaymentResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  useAwaitWebhook(submitted);

  useEffect(() => {
    let active = true;
    void startPaymentAction(number, token).then((result) => {
      if (active) setSession(result);
    });
    return () => {
      active = false;
    };
  }, [number, token, declineCode]);

  const amount = formatPrice(totalUzs, locale);
  const reason = declineCode
    ? t(
        `declineReasons.${declineCode === 'insufficient_funds' || declineCode === 'card_declined' ? declineCode : 'generic'}`,
      )
    : null;

  return (
    <section
      className="space-y-4 rounded-2xl border border-brand/40 bg-graphite-950/80 p-5 shadow-glow-sm"
      data-testid="payment-panel"
      aria-labelledby="pay-title"
    >
      <h2 id="pay-title" className="flex items-center gap-2 font-display text-lg font-bold">
        <CreditCardIcon className="size-5 text-brand-bright" />
        {t('title')}
      </h2>
      {session?.ok && (
        <p className="flex items-center gap-2 text-xs text-steel-300">
          <TimerIcon className="size-4" />
          {t('reserved', {
            time: formatDate(session.expiresAt, locale, { hour: '2-digit', minute: '2-digit' }),
          })}
        </p>
      )}
      {reason && !submitted && (
        <p
          role="alert"
          className="flex gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          data-testid="payment-declined"
        >
          <ShieldAlertIcon className="size-4 shrink-0" />
          {t('declined', { reason })}
        </p>
      )}
      {submitted ? (
        <p className="text-sm text-steel-300" data-testid="payment-waiting" aria-live="polite">
          {t('waiting')}
        </p>
      ) : !session ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : !session.ok ? (
        <p className="text-sm text-danger">{t('error')}</p>
      ) : session.provider === 'stripe' && publishableKey ? (
        <CheckoutElementsProvider
          stripe={getStripe(publishableKey)}
          options={{
            clientSecret: session.clientSecret,
            elementsOptions: {
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#D40000',
                  colorBackground: '#16161A',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  borderRadius: '8px',
                },
              },
            },
          }}
        >
          <StripeForm amount={amount} onSubmitted={() => setSubmitted(true)} />
          {locale === 'uz' && <p className="text-xs text-steel-400">{t('stripeLocale')}</p>}
        </CheckoutElementsProvider>
      ) : (
        <MockForm
          number={number}
          token={token}
          sessionId={session.sessionId}
          amount={amount}
          onSubmitted={() => setSubmitted(true)}
        />
      )}
    </section>
  );
}

function StripeForm({ amount, onSubmitted }: { amount: string; onSubmitted: () => void }) {
  const t = useTranslations('order.pay');
  const checkout = useCheckoutElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (checkout.type === 'loading') return <Skeleton className="h-40 rounded-lg" />;
  if (checkout.type === 'error') return <p className="text-sm text-danger">{t('error')}</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          // 3-D Secure Stripe показывает сам; без редиректа остаёмся на странице и ждём вебхук
          const result = await checkout.checkout.confirm({ redirect: 'if_required' });
          if (result.type === 'error') setError(result.error.message);
          else onSubmitted();
        });
      }}
    >
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <ShieldCheckIcon />
        {pending ? t('processing') : t('button', { amount })}
      </Button>
    </form>
  );
}

const testCards = [
  { number: '4242 4242 4242 4242', preset: 'success' },
  { number: '4000 0025 0000 3155', preset: 'threeDS' },
  { number: '4000 0000 0000 9995', preset: 'declined' },
] as const;

/** Демо-шлюз: тестовые карты Stripe, событие уходит в наш вебхук. */
function MockForm({
  number,
  token,
  sessionId,
  amount,
  onSubmitted,
}: {
  number: string;
  token: string | null;
  sessionId: string;
  amount: string;
  onSubmitted: () => void;
}) {
  const t = useTranslations('order.pay');
  const router = useRouter();
  const [card, setCard] = useState<string>(testCards[0].number);
  const [threeDS, setThreeDS] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pay(action: { card: string } | { expire: true }) {
    setError(null);
    startTransition(async () => {
      const result = await mockPayAction(number, token, sessionId, action);
      if (!result.ok) {
        setError(result.error === 'unknown_card' ? t('mock.unknownCard') : t('error'));
        return;
      }
      onSubmitted();
      router.refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (card.replace(/\D/g, '') === '4000002500003155') setThreeDS(true);
    else pay({ card });
  }

  return (
    <div className="space-y-4" data-testid="mock-payment">
      <p className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-steel-300">
        {t('mock.hint')}
      </p>
      {threeDS ? (
        <div
          className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4"
          role="dialog"
          aria-labelledby="threeds-title"
          data-testid="threeds"
        >
          <p id="threeds-title" className="font-semibold">
            {t('mock.threeDSTitle')}
          </p>
          <p className="text-sm text-steel-300">{t('mock.threeDSBody', { amount })}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => pay({ card })}
              data-testid="threeds-confirm"
            >
              {t('mock.confirm')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setThreeDS(false);
                pay({ card: '4000000000000002' });
              }}
            >
              {t('mock.fail')}
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={onSubmit}>
          <Label htmlFor="mock-card">{t('mock.card')}</Label>
          <Input
            id="mock-card"
            inputMode="numeric"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            className="font-mono tracking-wider"
            data-testid="mock-card"
          />
          <div className="flex flex-wrap gap-1.5">
            {testCards.map((c) => (
              <button
                key={c.number}
                type="button"
                onClick={() => setCard(c.number)}
                className="rounded border border-white/10 px-2 py-1 font-mono text-[11px] text-steel-300 hover:border-brand-bright/50"
              >
                {`${c.number.slice(-4)} · ${t(`mock.presets.${c.preset}`)}`}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
            data-testid="mock-pay"
          >
            {pending ? t('processing') : t('button', { amount })}
          </Button>
          <button
            type="button"
            className="text-xs text-steel-400 hover:underline"
            disabled={pending}
            onClick={() => pay({ expire: true })}
            data-testid="mock-expire"
          >
            {t('mock.expire')}
          </button>
        </form>
      )}
    </div>
  );
}
