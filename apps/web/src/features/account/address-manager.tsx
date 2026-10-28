'use client';

import { MapPinIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAddressAction, saveAddressAction } from '@/server/account-actions';

export interface AddressView {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  isDefault: boolean;
}

const fields = [
  'recipient',
  'phone',
  'city',
  'district',
  'street',
  'house',
  'apartment',
  'landmark',
] as const;
type FieldKey = (typeof fields)[number];

export function AddressManager({
  addresses,
  zones,
}: {
  addresses: AddressView[];
  zones: { code: string; name: string }[];
}) {
  const t = useTranslations('account.addresses');
  const tc = useTranslations('checkout');
  const [open, setOpen] = useState(addresses.length === 0);
  const [zoneCode, setZoneCode] = useState(
    zones.find((z) => z.code === 'tashkent-city')?.code ?? zones[0]?.code ?? '',
  );
  const [values, setValues] = useState<Record<FieldKey, string>>(
    Object.fromEntries(fields.map((f) => [f, ''])) as Record<FieldKey, string>,
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const label = (key: FieldKey) =>
    key === 'recipient'
      ? t('recipient')
      : key === 'phone'
        ? tc('contact.phone')
        : tc(`delivery.${key}`);

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !open && <p className="text-steel-300">{t('empty')}</p>}
      <ul className="space-y-3">
        {addresses.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-xl border border-graphite-800 bg-graphite-900 p-4 text-sm"
            data-testid="address"
          >
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
            <div className="min-w-0 flex-1 space-y-1">
              <p>{a.label}</p>
              <p className="text-xs text-steel-400">{`${a.recipient} · ${a.phone}`}</p>
              {a.isDefault && <Badge variant="success">{t('default')}</Badge>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('delete')}
              onClick={() => {
                if (!window.confirm(t('deleteConfirm'))) return;
                startTransition(async () => {
                  await deleteAddressAction(a.id);
                  toast.success(t('deleted'));
                });
              }}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>

      {open ? (
        <form
          className="grid gap-4 rounded-2xl border border-graphite-800 bg-graphite-900/60 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await saveAddressAction({
                zoneCode,
                ...values,
                district: values.district || undefined,
                apartment: values.apartment || undefined,
                landmark: values.landmark || undefined,
              });
              if (!result.ok) {
                setInvalid(result.fields ?? []);
                return;
              }
              toast.success(t('saved'));
              setOpen(false);
              setInvalid([]);
              setValues(Object.fromEntries(fields.map((f) => [f, ''])) as Record<FieldKey, string>);
            });
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-zone">{tc('delivery.zone')}</Label>
            <select
              id="ad-zone"
              value={zoneCode}
              onChange={(e) => setZoneCode(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-graphite-900 px-3 text-sm"
            >
              {zones.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          {fields.map((key) => (
            <div
              key={key}
              className={key === 'landmark' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}
            >
              <Label htmlFor={`ad-${key}`}>{label(key)}</Label>
              <Input
                id={`ad-${key}`}
                type={key === 'phone' ? 'tel' : 'text'}
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                aria-invalid={invalid.includes(key)}
              />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <PlusIcon />
          {t('add')}
        </Button>
      )}
    </div>
  );
}
