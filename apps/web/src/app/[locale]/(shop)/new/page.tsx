import { isLocale } from '@redcore/i18n';
import { sortProducts, type ProductSummary } from '@redcore/services';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/features/catalog/breadcrumbs';
import { ProductGrid } from '@/features/catalog/product-grid';
import { localizedAlternates } from '@/lib/seo';
import { getChipNames, getSnapshot } from '@/server/catalog';
import { Reveal } from '@/components/motion/reveal';

export const revalidate = 300;

/**
 * Новинки — железо последнего поколения. В каталоге нет даты поступления, поэтому подборка
 * задана правилами по названию: порядок групп на странице совпадает с порядком здесь.
 */
const NEW_ARRIVALS: { componentType: ProductSummary['componentType']; name: RegExp }[] = [
  { componentType: 'gpu', name: /RTX 50\d0|RX 90\d0|Arc B5/ },
  { componentType: 'cpu', name: /Ryzen \d 9\d{3}|Core Ultra/ },
  { componentType: 'motherboard', name: /X870|B850|Z890|B860/ },
  { componentType: 'monitor', name: /OLED/ },
];

export async function generateMetadata({ params }: PageProps<'/[locale]/new'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.newPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, '/new'),
  };
}

export default async function NewArrivalsPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [snapshot, chipNames, t] = await Promise.all([
    getSnapshot(locale),
    getChipNames(),
    getTranslations({ locale, namespace: 'shop.newPage' }),
  ]);
  const groups = NEW_ARRIVALS.flatMap((rule) => {
    const category = snapshot.categories.find((c) => c.componentType === rule.componentType);
    const products = sortProducts(
      snapshot.products.filter(
        (p) => p.componentType === rule.componentType && rule.name.test(p.name),
      ),
      'popular',
    );
    return category && products.length > 0 ? [{ category, products }] : [];
  });

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-3xl text-steel-300">{t('subtitle')}</p>
      </header>
      {groups.map((group, i) => (
        <Reveal as="section" stagger key={group.category.slug} className="space-y-5">
          <h2 className="font-display text-2xl font-bold tracking-tight">{group.category.name}</h2>
          <ProductGrid
            products={group.products}
            chipNames={chipNames}
            priorityCount={i === 0 ? undefined : 0}
          />
        </Reveal>
      ))}
    </div>
  );
}
