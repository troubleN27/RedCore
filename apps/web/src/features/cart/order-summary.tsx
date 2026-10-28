'use client';

import { formatPrice } from '@redcore/i18n';
import { TicketPercentIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CartQuoteResult } from '@/server/shop-actions';
import { useCheckoutStore } from '@/stores/checkout-store';

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'success';
}) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-3', strong ? 'text-base' : 'text-sm')}
    >
      <dt className={strong ? 'font-semibold' : 'text-steel-300'}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong && 'font-display text-xl font-bold',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Итог заказа: одинаковый в корзине и в оформлении. */
export function OrderTotals({
  data,
  showDelivery,
}: {
  data: CartQuoteResult;
  showDelivery: boolean;
}) {
  const t = useTranslations('cart.summary');
  const locale = useLocale();
  const price = (amount: number) => formatPrice(amount, locale);
  return (
    <dl className="space-y-2" data-testid="order-totals">
      <Row label={t('subtotal')} value={price(data.subtotalUzs)} />
      {data.discountUzs > 0 && (
        <Row label={t('discount')} value={`−${price(data.discountUzs)}`} tone="success" />
      )}
      <Row
        label={t('delivery')}
        value={showDelivery ? price(data.deliveryUzs) : t('deliveryAtCheckout')}
      />
      {data.servicesUzs > 0 && <Row label={t('services')} value={price(data.servicesUzs)} />}
      <div className="border-t border-white/5 pt-3" data-testid="order-total">
        <Row
          label={t('total')}
          value={price(showDelivery ? data.totalUzs : data.totalUzs - data.deliveryUzs)}
          strong
        />
      </div>
    </dl>
  );
}

export function PromoField({ data }: { data: CartQuoteResult }) {
  const t = useTranslations('cart.promo');
  const { promoCode, setPromo } = useCheckoutStore();
  const [value, setValue] = useState('');
  const promo = data.promo;

  if (promoCode && promo?.applied) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
        data-testid="promo-applied"
      >
        <span className="inline-flex items-center gap-2">
          <TicketPercentIcon className="size-4" />
          {t('applied', { code: promo.code })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('remove')}
          onClick={() => setPromo(null)}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  // Не <form>: поле живёт и внутри формы оформления, где Enter не должен отправлять заказ
  const apply = () => {
    if (value.trim()) setPromo(value.trim());
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="promo-code" className="text-xs text-steel-300">
        {t('label')}
      </Label>
      <div className="flex gap-2">
        <Input
          id="promo-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder={t('placeholder')}
          className="font-mono uppercase"
          aria-invalid={Boolean(promoCode && promo && !promo.applied)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={apply} data-testid="promo-apply">
          {t('apply')}
        </Button>
      </div>
      {promoCode && promo && !promo.applied && promo.error && (
        <p
          className="flex items-center justify-between gap-2 text-xs text-danger"
          role="alert"
          data-testid="promo-error"
        >
          {t(`errors.${promo.error}`)}
          <button
            type="button"
            className="text-steel-300 hover:underline"
            onClick={() => setPromo(null)}
          >
            {t('remove')}
          </button>
        </p>
      )}
    </div>
  );
}
