import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { listAddresses } from '@redcore/services';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CheckoutForm, type SavedAddress } from '@/features/checkout/checkout-form';
import { getSession } from '@/server/auth';
import { paymentProvider } from '@/server/payments';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false } };
}

const TEMP_EMAIL = /@phone\.redcore\.local$/;

export default async function CheckoutPage({ params }: PageProps<'/[locale]/checkout'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [t, session] = await Promise.all([
    getTranslations({ locale, namespace: 'checkout' }),
    getSession(),
  ]);
  const user = session?.user as
    { id: string; name: string; email: string; phoneNumber?: string | null } | undefined;

  const addresses: SavedAddress[] = user
    ? (await listAddresses(await getDb(), user.id)).map(({ address: a, zoneCode, zoneName }) => ({
        id: a.id,
        zoneCode,
        label: [zoneName[locale], a.city, a.street, a.house, a.apartment, a.landmark]
          .filter(Boolean)
          .join(', '),
        city: a.city,
        district: a.district,
        street: a.street,
        house: a.house,
        apartment: a.apartment,
        landmark: a.landmark,
      }))
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      <CheckoutForm
        user={
          user
            ? {
                name: user.name,
                phone: user.phoneNumber ?? null,
                email: TEMP_EMAIL.test(user.email) ? null : user.email,
              }
            : null
        }
        addresses={addresses}
        paymentProvider={paymentProvider()}
      />
    </div>
  );
}
