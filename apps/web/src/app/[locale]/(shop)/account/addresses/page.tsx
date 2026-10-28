import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { listAddresses, quoteCart } from '@redcore/services';
import { notFound } from 'next/navigation';
import { AddressManager } from '@/features/account/address-manager';
import { getSession } from '@/server/auth';
import { getSnapshot } from '@/server/catalog';

export default async function AccountAddressesPage({
  params,
}: PageProps<'/[locale]/account/addresses'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (!session) notFound();
  const db = await getDb();
  const [rows, quote] = await Promise.all([
    listAddresses(db, session.user.id),
    // Пустой расчёт отдаёт список зон доставки на нужном языке
    quoteCart(db, await getSnapshot(locale), { items: [] }),
  ]);
  return (
    <AddressManager
      zones={quote.zones.filter((z) => !z.isPickup).map((z) => ({ code: z.code, name: z.name }))}
      addresses={rows.map(({ address: a, zoneName }) => ({
        id: a.id,
        label: [zoneName[locale], a.city, a.district, a.street, a.house, a.apartment, a.landmark]
          .filter(Boolean)
          .join(', '),
        recipient: a.recipient,
        phone: a.phone,
        isDefault: a.isDefault,
      }))}
    />
  );
}
