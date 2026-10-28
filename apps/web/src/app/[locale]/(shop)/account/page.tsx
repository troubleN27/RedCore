import { isLocale } from '@redcore/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProfileForm } from '@/features/account/profile-form';
import { getSession } from '@/server/auth';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title'), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (!session) notFound();
  const t = await getTranslations({ locale, namespace: 'account' });
  const user = session.user as typeof session.user & {
    phoneNumber?: string | null;
    locale?: string;
  };
  return (
    <div className="space-y-4">
      <ProfileForm
        initial={{
          name: user.name.startsWith('+') ? '' : user.name,
          email: user.email.endsWith('@phone.redcore.local') ? null : user.email,
          phone: user.phoneNumber ?? null,
          locale: user.locale ?? locale,
        }}
      />
      <p className="text-xs text-steel-400">{t('synced')}</p>
    </div>
  );
}
