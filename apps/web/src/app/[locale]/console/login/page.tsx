import { isLocale } from '@redcore/i18n';
import { notFound, redirect } from 'next/navigation';
import { StaffLogin } from '@/features/console/staff-login';
import { adminBasePath } from '@/lib/admin-path';
import { getStaff } from '@/server/staff';

export default async function StaffLoginPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/login'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await getStaff();
  // Уже вошёл с 2FA — сразу в консоль; без 2FA — только подключение
  if (staff?.twoFactorEnabled) redirect(adminBasePath() ?? '/');
  const enroll = Boolean(staff) || (await searchParams).step === 'enroll';
  const step = enroll && staff ? 'enroll' : 'password';
  return <StaffLogin initialStep={step} />;
}
