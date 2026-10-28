'use client';

import type { OrderStatus } from '@redcore/domain';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeOrderStatusAction, refundOrderAction } from '@/server/console-actions';

export function OrderStatusControls({ orderId, next }: { orderId: string; next: OrderStatus[] }) {
  const t = useTranslations('console.orders.detail');
  const ts = useTranslations('order.status');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  if (next.length === 0) return <p className="text-sm text-steel-400">{t('noActions')}</p>;
  return (
    <div className="space-y-3">
      <Label htmlFor="status-note" className="text-xs text-steel-300">
        {t('note')}
      </Label>
      <Input
        id="status-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
      />
      <div className="flex flex-wrap gap-2">
        {next.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={status === 'cancelled' ? 'destructive' : 'default'}
            disabled={pending}
            data-testid={`to-${status}`}
            onClick={() =>
              startTransition(async () => {
                const result = await changeOrderStatusAction(orderId, status, note);
                if (result.ok) {
                  toast.success(tc('saved'));
                  setNote('');
                  router.refresh();
                } else toast.error(tc('error'));
              })
            }
          >
            {t('changeStatus', { status: ts(status) })}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function RefundForm({ orderId, maxUzs }: { orderId: string; maxUzs: number }) {
  const t = useTranslations('console.orders.detail.refund');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState('');
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      data-testid="refund-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const value = Number(amount.replace(/\s/g, ''));
          const result = await refundOrderAction(orderId, {
            amountUzs: full ? undefined : value,
            restock,
            reason: reason || undefined,
          });
          if (result.ok) {
            toast.success(t('done'));
            // Статус обновит вебхук — перечитываем страницу чуть позже
            setTimeout(() => router.refresh(), 800);
          } else toast.error(tc('error'));
        });
      }}
    >
      <p className="text-xs text-steel-400">{t('hint')}</p>
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox checked={full} onCheckedChange={(v) => setFull(v === true)} />
        {t('full')}
      </Label>
      {!full && (
        <div className="space-y-1.5">
          <Label htmlFor="refund-amount">{t('amount')}</Label>
          <Input
            id="refund-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={maxUzs}
          />
        </div>
      )}
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox checked={restock} onCheckedChange={(v) => setRestock(v === true)} />
        {t('restock')}
      </Label>
      <div className="space-y-1.5">
        <Label htmlFor="refund-reason">{t('reason')}</Label>
        <Input
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </div>
      <Button type="submit" variant="destructive" disabled={pending} data-testid="refund-submit">
        {t('submit')}
      </Button>
    </form>
  );
}
