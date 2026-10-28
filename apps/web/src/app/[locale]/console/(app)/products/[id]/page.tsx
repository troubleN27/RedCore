import { getDb } from '@redcore/db';
import { specFormFields, type ComponentType, type SpecField } from '@redcore/domain';
import { formatDate, isLocale } from '@redcore/i18n';
import {
  getAdminProduct,
  listBrandOptions,
  listCategoryOptions,
  r2ConfigFromEnv,
} from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProductArt } from '@/components/brand/product-art';
import { ModelUpload } from '@/features/console/model-upload';
import { ProductForm, type ProductFormValues } from '@/features/console/product-form';
import { ProductViewer } from '@/features/product/product-viewer';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsoleProductPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/products/[id]'>) {
  await requireStaff('products');
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const db = await getDb();
  const [t, ts, categories, brandOptions] = await Promise.all([
    getTranslations({ locale, namespace: 'console.products' }),
    getTranslations({ locale, namespace: 'console.stock' }),
    listCategoryOptions(db, locale),
    listBrandOptions(db),
  ]);
  // Поля формы по схемам всех категорий: при создании категорию можно сменить
  const fieldsByCategory: Record<string, SpecField[]> = Object.fromEntries(
    categories.map((c) => [c.id, specFormFields(c.componentType as ComponentType)]),
  );

  const isNew = id === 'new';
  const data = isNew ? null : /^[0-9a-f-]{36}$/.test(id) ? await getAdminProduct(db, id) : null;
  if (!isNew && !data) notFound();

  const category = (await searchParams).category;
  const initial: ProductFormValues = data
    ? {
        sku: data.product.sku,
        slug: data.product.slug,
        name: data.product.name,
        brandId: data.product.brandId,
        categoryId: data.product.categoryId,
        priceUzs: data.product.priceUzs,
        compareAtPriceUzs: data.product.compareAtPriceUzs,
        costUzs: data.product.costUzs,
        status: data.product.status,
        isFeatured: data.product.isFeatured,
        warrantyMonths: data.product.warrantyMonths,
        specs: data.product.specs as Record<string, unknown>,
        shortRu: data.ru?.shortDescription ?? '',
        shortUz: data.uz?.shortDescription ?? '',
        descriptionRu: data.ru?.description ?? null,
        descriptionUz: data.uz?.description ?? null,
      }
    : {
        sku: '',
        slug: '',
        name: '',
        brandId: brandOptions[0]?.id ?? '',
        categoryId: categories.find((c) => c.slug === category)?.id ?? categories[0]?.id ?? '',
        priceUzs: 0,
        compareAtPriceUzs: null,
        costUzs: null,
        status: 'draft',
        isFeatured: false,
        warrantyMonths: 12,
        specs: {},
        shortRu: '',
        shortUz: '',
        descriptionRu: null,
        descriptionUz: null,
      };

  return (
    <>
      <PageHeader title={data ? data.product.name : t('new')} />
      <ProductForm
        id={data?.product.id}
        initial={initial}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        brands={brandOptions}
        fieldsByCategory={fieldsByCategory}
        stock={
          data
            ? { stockQty: data.product.stockQty, reservedQty: data.product.reservedQty }
            : undefined
        }
      />
      {data && (
        <Panel title={t('form.model')}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ProductViewer
              product={{ componentType: data.product.componentType, specs: data.product.specs }}
              customUrl={data.product.model3d?.customUrl ?? null}
              poster={
                <ProductArt
                  type={data.product.componentType}
                  brand=""
                  size="lg"
                  className="h-full w-full"
                />
              }
            />
            <ModelUpload
              productId={data.product.id}
              current={data.product.model3d?.customUrl ? data.product.model3d : null}
              r2={Boolean(r2ConfigFromEnv())}
            />
          </div>
        </Panel>
      )}
      {data && data.movements.length > 0 && (
        <Panel title={ts('movements')}>
          <DataTable
            empty=""
            columns={[
              { key: 'date', label: ts('cols.date') },
              { key: 'reason', label: ts('cols.reason') },
              { key: 'note', label: ts('cols.note') },
              { key: 'delta', label: ts('cols.delta'), align: 'right' },
            ]}
            rows={data.movements.map((m) => ({
              key: m.id,
              cells: {
                date: formatDate(m.createdAt, locale, { dateStyle: 'short', timeStyle: 'short' }),
                reason: ts(`reasons.${m.reason}`),
                note: m.note ?? '',
                delta: m.delta > 0 ? `+${m.delta}` : String(m.delta),
              },
            }))}
          />
        </Panel>
      )}
    </>
  );
}
