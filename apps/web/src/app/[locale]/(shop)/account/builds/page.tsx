import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { listUserBuilds } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BuildStatusLabel } from '@/features/configurator/compat-view';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/server/auth';

export default async function AccountBuildsPage({ params }: PageProps<'/[locale]/account/builds'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (!session) notFound();
  const [t, list] = await Promise.all([
    getTranslations({ locale, namespace: 'account.builds' }),
    listUserBuilds(await getDb(), session.user.id),
  ]);
  if (list.length === 0) return <p className="text-steel-300">{t('empty')}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((build) => (
        <li
          key={build.publicId}
          className="space-y-2 rounded-xl border border-graphite-800 bg-graphite-900 p-4"
        >
          <Link href={`/b/${build.publicId}`} className="block font-semibold hover:underline">
            {build.name ?? t('untitled', { id: build.publicId })}
          </Link>
          <BuildStatusLabel status={build.compatStatus} className="text-xs" />
          <p className="flex justify-between text-sm">
            <span className="text-steel-400">{formatDate(build.createdAt, locale)}</span>
            <span className="font-semibold tabular-nums">
              {formatPrice(build.totalUzs, locale)}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
