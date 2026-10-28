import { getDb } from '@redcore/db';
import { formatPrice, isLocale } from '@redcore/i18n';
import { listAdminProducts, listCategoryOptions } from '@redcore/services';
import { PlusIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from '@/features/console/console-base';
import { DataTable, PageHeader, Pager, SearchForm } from '@/features/console/ui';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/staff';

const STATUSES = ['active', 'draft', 'archived'] as const;
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function ConsoleProductsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/products'>) {
  await requireStaff('products');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const filter = {
    q: str(sp.q),
    category: str(sp.category),
    status: str(sp.status),
    page: Number(str(sp.page) ?? 1) || 1,
  };
  const db = await getDb();
  const [t, tc, data, categoryOptions] = await Promise.all([
    getTranslations({ locale, namespace: 'console.products' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listAdminProducts(db, filter),
    listCategoryOptions(db, locale),
  ]);
  const categoryName = new Map(categoryOptions.map((c) => [c.slug, c.name]));

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <ConsoleLink
            href="/products/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-cta px-4 text-sm font-semibold text-white"
          >
            <PlusIcon className="size-4" />
            {t('new')}
          </ConsoleLink>
        }
      />
      <SearchForm
        value={filter.q}
        placeholder={t('searchPlaceholder')}
        extra={
          <>
            <select
              name="category"
              defaultValue={filter.category ?? ''}
              aria-label={t('cols.category')}
              className="h-9 rounded-md border border-input bg-graphite-900 px-2 text-sm"
            >
              <option value="">{tc('all')}</option>
              {categoryOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filter.status ?? ''}
              aria-label={t('cols.status')}
              className="h-9 rounded-md border border-input bg-graphite-900 px-2 text-sm"
            >
              <option value="">{tc('all')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </>
        }
      />
      <DataTable
        testId="console-products"
        empty={tc('empty')}
        columns={[
          { key: 'name', label: t('cols.name') },
          { key: 'sku', label: t('cols.sku') },
          { key: 'category', label: t('cols.category') },
          { key: 'status', label: t('cols.status') },
          { key: 'stock', label: t('cols.stock'), align: 'right' },
          { key: 'price', label: t('cols.price'), align: 'right' },
        ]}
        rows={data.rows.map((p) => {
          const available = p.stockQty - p.reservedQty;
          return {
            key: p.id,
            cells: {
              name: (
                <ConsoleLink href={`/products/${p.id}`} className="hover:underline">
                  {`${p.brand} ${p.name}`}
                </ConsoleLink>
              ),
              sku: <span className="font-mono text-xs">{p.sku}</span>,
              category: categoryName.get(p.categorySlug) ?? p.categorySlug,
              status: (
                <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>
                  {t(`statuses.${p.status}`)}
                </Badge>
              ),
              stock: (
                <span
                  className={cn(available <= 3 && 'text-warning', available <= 0 && 'text-danger')}
                >{`${available} / ${p.stockQty}`}</span>
              ),
              price: formatPrice(p.priceUzs, locale),
            },
          };
        })}
      />
      <Pager
        page={data.page}
        pages={data.pages}
        basePath="/products"
        query={{ q: filter.q, category: filter.category, status: filter.status }}
        labels={{
          prev: tc('prev'),
          next: tc('next'),
          page: tc('page', { page: data.page, pages: data.pages }),
        }}
      />
    </>
  );
}
