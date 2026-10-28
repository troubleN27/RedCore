import type { CategoryInfo } from '@redcore/services';
import { formatPrice } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { componentIcons } from '@/components/brand/product-art';
import { Link } from '@/i18n/navigation';

export function CategoryTile({ category }: { category: CategoryInfo }) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const Icon = componentIcons[category.componentType];

  return (
    <Link
      href={`/catalog/${category.slug}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-glow-lg"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand-deep text-brand-bright transition-transform duration-300 ease-speed group-hover:scale-110">
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{category.name}</span>
        <span className="block text-xs text-steel-400">
          {t('productCount', { count: category.productCount })}
          {category.minPriceUzs !== null && (
            <>
              <span aria-hidden="true"> / </span>
              {t('fromPrice', { price: formatPrice(category.minPriceUzs, locale) })}
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
