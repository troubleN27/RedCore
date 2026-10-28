'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createPromoAction,
  moderateReviewAction,
  setUserBannedAction,
  setUserRoleAction,
  togglePromoAction,
  updateServiceAction,
  updateSettingsAction,
  updateZoneAction,
  type ActionResult,
} from '@/server/console-actions';

/** Выполнить действие консоли с тостом и обновлением страницы. */
function useConsoleAction() {
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(tc('saved'));
        onOk?.();
        router.refresh();
      } else toast.error(tc('error'));
    });
  return { pending, run };
}

const ROLES = ['customer', 'manager', 'admin'] as const;
const inputClass = 'h-8 w-full rounded-md border border-input bg-graphite-900 px-2 text-sm';
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '')));

export function ReviewModeration({
  id,
  status,
}: {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
}) {
  const t = useTranslations('console.reviews');
  const { pending, run } = useConsoleAction();
  return (
    <div className="flex gap-2">
      {status !== 'approved' && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => moderateReviewAction(id, 'approved'))}
          data-testid="review-approve"
        >
          {t('approve')}
        </Button>
      )}
      {status !== 'rejected' && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => moderateReviewAction(id, 'rejected'))}
        >
          {t('reject')}
        </Button>
      )}
    </div>
  );
}

export function PromoToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const { pending, run } = useConsoleAction();
  return (
    <Checkbox
      checked={isActive}
      disabled={pending}
      aria-label={id}
      onCheckedChange={(v) => run(() => togglePromoAction(id, v === true))}
    />
  );
}

export function PromoCreateForm() {
  const t = useTranslations('console.promos.form');
  const tp = useTranslations('console.promos.types');
  const tc = useTranslations('console.common');
  const { pending, run } = useConsoleAction();
  const empty = {
    code: '',
    type: 'percent',
    value: '',
    minOrderUzs: '',
    maxDiscountUzs: '',
    startsAt: '',
    endsAt: '',
    usageLimit: '',
    perUserLimit: '',
    descriptionRu: '',
    descriptionUz: '',
  };
  const [v, setV] = useState(empty);
  const field = (key: keyof typeof empty, label: string, type = 'text') => (
    <div className="space-y-1">
      <Label htmlFor={`promo-${key}`}>{label}</Label>
      <Input
        id={`promo-${key}`}
        type={type}
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      data-testid="promo-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createPromoAction({
              code: v.code,
              type: v.type as 'percent' | 'fixed',
              value: Number(v.value),
              minOrderUzs: num(v.minOrderUzs),
              maxDiscountUzs: num(v.maxDiscountUzs),
              startsAt: v.startsAt ? new Date(v.startsAt) : null,
              endsAt: v.endsAt ? new Date(v.endsAt) : null,
              usageLimit: num(v.usageLimit),
              perUserLimit: num(v.perUserLimit),
              isActive: true,
              descriptionRu: v.descriptionRu,
              descriptionUz: v.descriptionUz,
            }),
          () => setV(empty),
        );
      }}
    >
      {field('code', t('code'))}
      <div className="space-y-1">
        <Label htmlFor="promo-type">{t('type')}</Label>
        <select
          id="promo-type"
          value={v.type}
          onChange={(e) => setV({ ...v, type: e.target.value })}
          className={inputClass}
        >
          <option value="percent">{tp('percent')}</option>
          <option value="fixed">{tp('fixed')}</option>
        </select>
      </div>
      {field('value', t('value'))}
      {field('minOrderUzs', t('minOrder'))}
      {field('maxDiscountUzs', t('maxDiscount'))}
      {field('usageLimit', t('usageLimit'))}
      {field('perUserLimit', t('perUserLimit'))}
      {field('startsAt', t('startsAt'), 'date')}
      {field('endsAt', t('endsAt'), 'date')}
      {field('descriptionRu', t('descriptionRu'))}
      {field('descriptionUz', t('descriptionUz'))}
      <div className="flex items-end">
        <Button type="submit" disabled={pending || !v.code || !v.value} data-testid="promo-create">
          {tc('create')}
        </Button>
      </div>
    </form>
  );
}

export function UserControls({
  id,
  role,
  banned,
  isSelf,
}: {
  id: string;
  role: string;
  banned: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations('console.users');
  const tr = useTranslations('console.roles');
  const { pending, run } = useConsoleAction();
  if (isSelf) return <span className="text-xs text-steel-400">{t('self')}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        disabled={pending}
        aria-label={t('cols.role')}
        onChange={(e) => run(() => setUserRoleAction(id, e.target.value))}
        className="h-8 rounded-md border border-input bg-graphite-900 px-2 text-xs"
        data-testid="user-role"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {tr(r)}
          </option>
        ))}
      </select>
      <Button
        size="xs"
        variant={banned ? 'outline' : 'destructive'}
        disabled={pending}
        onClick={() => run(() => setUserBannedAction(id, !banned))}
      >
        {banned ? t('unban') : t('ban')}
      </Button>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: { usdUzsRate: number; phone: string } }) {
  const t = useTranslations('console.settings');
  const tc = useTranslations('console.common');
  const { pending, run } = useConsoleAction();
  const [v, setV] = useState({
    usdUzsRate: String(initial.usdUzsRate),
    phone: initial.phone,
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      data-testid="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateSettingsAction({
            usdUzsRate: Number(v.usdUzsRate.replace(',', '.')),
            phone: v.phone,
          }),
        );
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="st-rate">{t('rate')}</Label>
        <Input
          id="st-rate"
          inputMode="decimal"
          value={v.usdUzsRate}
          onChange={(e) => setV({ ...v, usdUzsRate: e.target.value })}
        />
        <p className="text-xs text-steel-400">{t('rateHint')}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="st-phone">{t('phone')}</Label>
        <Input
          id="st-phone"
          value={v.phone}
          onChange={(e) => setV({ ...v, phone: e.target.value })}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {tc('save')}
        </Button>
      </div>
    </form>
  );
}

export function ZoneRow({
  zone,
}: {
  zone: {
    id: string;
    name: string;
    priceUzs: number;
    freeFromUzs: number | null;
    etaMinDays: number;
    etaMaxDays: number;
    codAllowed: boolean;
    isActive: boolean;
  };
}) {
  const tc = useTranslations('console.common');
  const { pending, run } = useConsoleAction();
  const [v, setV] = useState({
    priceUzs: String(zone.priceUzs),
    freeFromUzs: zone.freeFromUzs === null ? '' : String(zone.freeFromUzs),
    etaMinDays: String(zone.etaMinDays),
    etaMaxDays: String(zone.etaMaxDays),
    codAllowed: zone.codAllowed,
    isActive: zone.isActive,
  });
  return (
    <tr className="text-sm">
      <td className="px-3 py-2">{zone.name}</td>
      <td className="px-3 py-2">
        <input
          aria-label={zone.name}
          className={inputClass}
          value={v.priceUzs}
          onChange={(e) => setV({ ...v, priceUzs: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label={zone.name}
          className={inputClass}
          value={v.freeFromUzs}
          onChange={(e) => setV({ ...v, freeFromUzs: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <input
            aria-label={zone.name}
            className={inputClass}
            value={v.etaMinDays}
            onChange={(e) => setV({ ...v, etaMinDays: e.target.value })}
          />
          <input
            aria-label={zone.name}
            className={inputClass}
            value={v.etaMaxDays}
            onChange={(e) => setV({ ...v, etaMaxDays: e.target.value })}
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Checkbox
          checked={v.codAllowed}
          onCheckedChange={(c) => setV({ ...v, codAllowed: c === true })}
          aria-label={zone.name}
        />
      </td>
      <td className="px-3 py-2">
        <Checkbox
          checked={v.isActive}
          onCheckedChange={(c) => setV({ ...v, isActive: c === true })}
          aria-label={zone.name}
        />
      </td>
      <td className="px-3 py-2">
        <Button
          size="xs"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateZoneAction(zone.id, {
                priceUzs: Number(v.priceUzs),
                freeFromUzs: num(v.freeFromUzs),
                etaMinDays: Number(v.etaMinDays),
                etaMaxDays: Number(v.etaMaxDays),
                codAllowed: v.codAllowed,
                isActive: v.isActive,
              }),
            )
          }
        >
          {tc('save')}
        </Button>
      </td>
    </tr>
  );
}

export function ServiceRow({
  service,
}: {
  service: { id: string; name: string; priceUzs: number; isActive: boolean };
}) {
  const tc = useTranslations('console.common');
  const { pending, run } = useConsoleAction();
  const [price, setPrice] = useState(String(service.priceUzs));
  const [active, setActive] = useState(service.isActive);
  return (
    <tr className="text-sm">
      <td className="px-3 py-2">{service.name}</td>
      <td className="px-3 py-2">
        <input
          aria-label={service.name}
          className={inputClass}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <Checkbox
          checked={active}
          onCheckedChange={(c) => setActive(c === true)}
          aria-label={service.name}
        />
      </td>
      <td className="px-3 py-2">
        <Button
          size="xs"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateServiceAction(service.id, { priceUzs: Number(price), isActive: active }),
            )
          }
        >
          {tc('save')}
        </Button>
      </td>
    </tr>
  );
}
