'use client';

import { normalizeUzPhone } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { BanknoteIcon, CreditCardIcon, StoreIcon, WrenchIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderTotals, PromoField } from '@/features/cart/order-summary';
import { useCartQuote } from '@/features/cart/use-cart-quote';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { placeOrderAction } from '@/server/shop-actions';
import { useCheckoutStore } from '@/stores/checkout-store';
import { cartLines, useShopStore } from '@/stores/shop-store';

export interface SavedAddress {
  id: string;
  zoneCode: string;
  label: string;
  city: string;
  district: string | null;
  street: string;
  house: string;
  apartment: string | null;
  landmark: string | null;
}

interface AddressFields {
  city: string;
  district: string;
  street: string;
  house: string;
  apartment: string;
  landmark: string;
}

const ADDRESS_INPUTS = ['city', 'district', 'street', 'house', 'apartment'] as const;
const emptyAddress: AddressFields = {
  city: '',
  district: '',
  street: '',
  house: '',
  apartment: '',
  landmark: '',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-graphite-800 bg-graphite-900/60 p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-steel-400">{hint}</p>
      )}
    </div>
  );
}

export function CheckoutForm({
  user,
  addresses,
  paymentProvider,
}: {
  user: { name: string; phone: string | null; email: string | null } | null;
  addresses: SavedAddress[];
  paymentProvider: 'stripe' | 'mock' | null;
}) {
  const t = useTranslations('checkout');
  const ta = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const cart = useShopStore((s) => s.cart);
  const clearCart = useShopStore((s) => s.clearCart);
  const { zoneCode, setZone, serviceKeys, toggleService, promoCode, reset } = useCheckoutStore();

  const [name, setName] = useState(user?.name && !user.name.startsWith('+') ? user.name : '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const defaultAddress = addresses[0];
  const [addressId, setAddressId] = useState<string | 'new'>(defaultAddress?.id ?? 'new');
  const [address, setAddress] = useState<AddressFields>(emptyAddress);
  const [saveAddress, setSaveAddress] = useState(Boolean(user));
  const [method, setMethod] = useState<'card' | 'cod'>(paymentProvider ? 'card' : 'cod');
  const [comment, setComment] = useState('');
  const [attemptId] = useState(() => crypto.randomUUID());
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const normalizedPhone = normalizeUzPhone(phone);
  const { data } = useCartQuote(normalizedPhone);
  const zone = data?.zones.find((z) => z.code === zoneCode) ?? data?.zones[0];
  const saved = addresses.find((a) => a.id === addressId && a.zoneCode === zone?.code);
  const needsAddress = zone ? !zone.isPickup : false;
  const codAllowed = zone?.codAllowed ?? true;
  const effectiveMethod = method === 'cod' && !codAllowed ? 'card' : method;
  const price = (amount: number) => formatPrice(amount, locale);

  const errors = {
    name: name.trim().length < 2 ? t('required') : null,
    phone: normalizedPhone ? null : t('required'),
    email: email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? t('required') : null,
    city: needsAddress && !saved && address.city.trim().length < 2 ? t('required') : null,
    street: needsAddress && !saved && address.street.trim().length < 2 ? t('required') : null,
    house: needsAddress && !saved && !address.house.trim() ? t('required') : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setServerError(null);
    if (invalid || !data || !zone) return;
    if (effectiveMethod === 'card' && !paymentProvider) return;

    const chosen = saved
      ? {
          city: saved.city,
          district: saved.district ?? undefined,
          street: saved.street,
          house: saved.house,
          apartment: saved.apartment ?? undefined,
          landmark: saved.landmark ?? undefined,
        }
      : {
          city: address.city,
          district: address.district || undefined,
          street: address.street,
          house: address.house,
          apartment: address.apartment || undefined,
          landmark: address.landmark || undefined,
        };
    startTransition(async () => {
      const result = await placeOrderAction(locale, {
        checkoutAttemptId: attemptId,
        items: cartLines(cart),
        contact: { name, phone, email },
        zoneCode: zone.code,
        address: needsAddress ? chosen : undefined,
        serviceKeys: data.selectedServices,
        promoCode: promoCode ?? undefined,
        paymentMethod: effectiveMethod,
        comment: comment || undefined,
        saveAddress: Boolean(user) && needsAddress && !saved && saveAddress,
      });
      if (!result.ok) {
        const names = Array.isArray(result.details)
          ? result.details
              .map((slug) => data.lines.find((l) => l.slug === slug)?.name ?? slug)
              .join(', ')
          : '';
        setServerError(
          result.error === 'out_of_stock'
            ? t('errors.out_of_stock', { names })
            : t(`errors.${result.error}`),
        );
        return;
      }
      clearCart();
      reset();
      router.push(`/orders/${result.number}?token=${result.token}&new=1`);
    });
  }

  if (!data) return <Skeleton className="h-[40rem] rounded-2xl" />;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
      data-testid="checkout-form"
    >
      <div className="min-w-0 space-y-6">
        {!user && (
          <p className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm text-steel-300">
            {t('signInPrompt')}{' '}
            <Link
              href="/login?next=/checkout"
              className="font-medium text-info underline underline-offset-2"
            >
              {ta('signIn')}
            </Link>
          </p>
        )}

        <Section title={t('sections.contact')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="co-name" label={t('contact.name')} error={show('name')}>
              <Input
                id="co-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(show('name'))}
              />
            </Field>
            <Field
              id="co-phone"
              label={t('contact.phone')}
              hint={t('contact.phoneHint')}
              error={show('phone')}
            >
              <Input
                id="co-phone"
                type="tel"
                autoComplete="tel"
                placeholder={ta('phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(show('phone'))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="co-email"
                label={t('contact.email')}
                hint={t('contact.emailHint')}
                error={show('email')}
              >
                <Input
                  id="co-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title={t('sections.delivery')}>
          <Field id="co-zone" label={t('delivery.zone')}>
            <select
              id="co-zone"
              value={zone?.code}
              onChange={(e) => setZone(e.target.value)}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-graphite-900 px-3 text-sm"
              data-testid="zone-select"
            >
              {data.zones.map((z) => (
                <option key={z.code} value={z.code}>
                  {`${z.name} · ${z.priceUzs === 0 || (z.freeFromUzs !== null && data.subtotalUzs - data.discountUzs >= z.freeFromUzs) ? t('delivery.free') : price(z.priceUzs)} · ${
                    z.isPickup
                      ? t('delivery.today')
                      : t('delivery.eta', { min: z.etaMinDays, max: z.etaMaxDays })
                  }`}
                </option>
              ))}
            </select>
          </Field>

          {zone?.isPickup ? (
            <p className="flex gap-2 text-sm text-steel-300">
              <StoreIcon className="size-4 shrink-0 text-brand-bright" />
              {t('delivery.pickupInfo')}
            </p>
          ) : (
            <div className="space-y-4">
              {addresses.some((a) => a.zoneCode === zone?.code) && (
                <div
                  className="space-y-2"
                  role="radiogroup"
                  aria-label={t('delivery.savedAddress')}
                >
                  {addresses
                    .filter((a) => a.zoneCode === zone?.code)
                    .map((a) => (
                      <label
                        key={a.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-graphite-800 p-3 text-sm has-[:checked]:border-brand/60"
                      >
                        <input
                          type="radio"
                          name="address"
                          checked={addressId === a.id}
                          onChange={() => setAddressId(a.id)}
                          className="mt-1 accent-[#d40000]"
                        />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-graphite-800 p-3 text-sm has-[:checked]:border-brand/60">
                    <input
                      type="radio"
                      name="address"
                      checked={!saved}
                      onChange={() => setAddressId('new')}
                      className="accent-[#d40000]"
                    />
                    {t('delivery.newAddress')}
                  </label>
                </div>
              )}
              {!saved && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {ADDRESS_INPUTS.map((key) => (
                    <Field
                      key={key}
                      id={`co-${key}`}
                      label={t(`delivery.${key}`)}
                      error={key in errors ? show(key as keyof typeof errors) : null}
                    >
                      <Input
                        id={`co-${key}`}
                        value={address[key]}
                        onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                        aria-invalid={key in errors && Boolean(show(key as keyof typeof errors))}
                      />
                    </Field>
                  ))}
                  <div className="sm:col-span-2">
                    <Field
                      id="co-landmark"
                      label={t('delivery.landmark')}
                      hint={t('delivery.landmarkHint')}
                    >
                      <Input
                        id="co-landmark"
                        value={address.landmark}
                        onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                      />
                    </Field>
                  </div>
                  {user && (
                    <Label className="flex items-center gap-2 font-normal sm:col-span-2">
                      <Checkbox
                        checked={saveAddress}
                        onCheckedChange={(v) => setSaveAddress(v === true)}
                      />
                      {t('delivery.saveAddress')}
                    </Label>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>

        {data.services.length > 0 && (
          <Section title={t('sections.services')}>
            <p className="text-xs text-steel-400">{t('services.assemblyHint')}</p>
            <div className="space-y-2">
              {data.services.map((service) => (
                <label
                  key={service.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-graphite-800 p-3 has-[[data-state=checked]]:border-brand/60"
                >
                  <Checkbox
                    checked={serviceKeys.includes(service.key)}
                    onCheckedChange={() => toggleService(service.key)}
                    className="mt-0.5"
                    data-testid={`service-${service.key}`}
                  />
                  <span className="flex-1 space-y-1">
                    <span className="flex items-center justify-between gap-3 text-sm font-medium">
                      <span className="inline-flex items-center gap-2">
                        <WrenchIcon className="size-4 text-brand-bright" />
                        {service.name}
                      </span>
                      <span className="tabular-nums">{price(service.priceUzs)}</span>
                    </span>
                    <span className="block text-xs text-steel-400">{service.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>
        )}

        <Section title={t('sections.payment')}>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label={t('sections.payment')}
          >
            {[
              {
                value: 'card' as const,
                icon: CreditCardIcon,
                title: t('payment.card'),
                hint: !paymentProvider
                  ? t('payment.cardDisabled')
                  : paymentProvider === 'mock'
                    ? t('payment.cardMockHint')
                    : t('payment.cardHint'),
                disabled: !paymentProvider,
              },
              {
                value: 'cod' as const,
                icon: BanknoteIcon,
                title: t('payment.cod'),
                hint: codAllowed ? t('payment.codHint') : t('payment.codNotAllowed'),
                disabled: !codAllowed,
              },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border border-graphite-800 p-4 has-[:checked]:border-brand/60 has-[:checked]:bg-brand/5',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={option.value}
                  checked={effectiveMethod === option.value}
                  disabled={option.disabled}
                  onChange={() => setMethod(option.value)}
                  className="mt-1 accent-[#d40000]"
                  data-testid={`payment-${option.value}`}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <option.icon className="size-4 text-brand-bright" />
                    {option.title}
                  </span>
                  <span className="block text-xs text-steel-400">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section title={t('sections.comment')}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t('commentPlaceholder')}
            aria-label={t('sections.comment')}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-5 rounded-2xl border border-white/10 bg-graphite-950/80 p-5 shadow-panel">
          <ul className="max-h-60 space-y-2 overflow-y-auto pr-1 text-sm">
            {data.lines.map((line) => (
              <li key={line.slug} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-steel-300">
                  {line.qty > 1 ? `${line.name} × ${line.qty}` : line.name}
                </span>
                <span className="shrink-0 tabular-nums">{price(line.totalUzs)}</span>
              </li>
            ))}
          </ul>
          <PromoField data={data} />
          <OrderTotals data={data} showDelivery />
          {serverError && (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              data-testid="checkout-error"
            >
              {serverError}
            </p>
          )}
          {touched && invalid && !serverError && (
            <p className="text-sm text-danger">{t('errors.invalid')}</p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending || data.lines.length === 0}
            data-testid="place-order"
          >
            {pending ? t('submitting') : t('submit', { amount: price(data.totalUzs) })}
          </Button>
          <p className="text-xs text-steel-400">{t('agree')}</p>
        </div>
      </aside>
    </form>
  );
}
