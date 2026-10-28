import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { listUsers } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { UserControls } from '@/features/console/controls';
import { DataTable, PageHeader, Pager, SearchForm } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function ConsoleUsersPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/users'>) {
  const staff = await requireStaff('users');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const filter = { q: str(sp.q), page: Number(str(sp.page) ?? 1) || 1 };
  const [t, tc, data] = await Promise.all([
    getTranslations({ locale, namespace: 'console.users' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listUsers(await getDb(), filter),
  ]);
  return (
    <>
      <PageHeader title={t('title')} />
      <SearchForm value={filter.q} placeholder={t('searchPlaceholder')} />
      <DataTable
        testId="console-users"
        empty={tc('empty')}
        columns={[
          { key: 'name', label: t('cols.name') },
          { key: 'contact', label: t('cols.contact') },
          { key: 'twoFactor', label: t('cols.twoFactor') },
          { key: 'created', label: t('cols.created') },
          { key: 'role', label: t('cols.role') },
        ]}
        rows={data.rows.map((u) => ({
          key: u.id,
          cells: {
            name: (
              <span>
                {u.name}
                {u.banned && (
                  <Badge variant="danger" className="ml-2">
                    {t('cols.banned')}
                  </Badge>
                )}
              </span>
            ),
            contact: (
              <span className="text-xs">
                {u.email.endsWith('@phone.redcore.local') ? '' : u.email}
                <span className="block text-steel-400">{u.phoneNumber ?? ''}</span>
              </span>
            ),
            twoFactor: u.twoFactorEnabled ? tc('yes') : tc('no'),
            created: formatDate(u.createdAt, locale),
            role: (
              <UserControls
                id={u.id}
                role={u.role}
                banned={Boolean(u.banned)}
                isSelf={u.id === staff.id}
              />
            ),
          },
        }))}
      />
      <Pager
        page={data.page}
        pages={data.pages}
        basePath="/users"
        query={{ q: filter.q }}
        labels={{
          prev: tc('prev'),
          next: tc('next'),
          page: tc('page', { page: data.page, pages: data.pages }),
        }}
      />
    </>
  );
}
