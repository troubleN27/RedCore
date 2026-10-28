import type { ProductSummary } from '@redcore/services';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { cardHighlights, formatSpecValue } from '../product/spec-format';
import { AddToCartButton, CompareButton, FavoriteButton } from './product-actions';
import { StockBadge } from './stock-badge';

export function ProductCard({
  product,
  chipNames,
  priority = false,
}: {
  product: ProductSummary;
  chipNames: Record<string, string>;
  priority?: boolean;
}) {
  const locale = useLocale();
  const tc = useTranslations('common');
  const ctx = { locale, dict: useMessages().specs, chipNames };
  const specs = product.specs as Record<string, unknown>;
  const highlights = (cardHighlights[product.componentType] ?? [])
    .map((key) => formatSpecValue(key, specs[key], ctx))
    .filter(Boolean);
  const href = `/p/${product.slug}`;

  return (
    <article
      data-testid="product-card"
      className="group relative flex flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/45 hover:shadow-glow-lg"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
      />
      <Link
        href={href}
        className="block p-3 pb-0"
        tabIndex={-1}
        aria-hidden="true"
        prefetch={priority}
      >
        <ProductArt type={product.componentType} brand={product.brand} />
      </Link>
      <div className="absolute top-5 right-5 z-10 flex flex-col gap-1">
        {product.isFeatured && <Badge variant="solid">{tc('badges.hit')}</Badge>}
        {product.compareAtPriceUzs && <Badge>{tc('badges.sale')}</Badge>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="label-caps text-steel-400">{product.brand}</p>
          <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-medium">
            <Link href={href} className="after:absolute after:inset-0 after:z-0 hover:text-white">
              {product.name}
            </Link>
          </h3>
          {highlights.length > 0 && (
            <p className="line-clamp-1 font-mono text-xs text-steel-300">
              {highlights.join(' · ')}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <StockBadge available={product.available} />
            <div className="relative z-10 flex">
              <CompareButton slug={product.slug} category={product.categorySlug} />
              <FavoriteButton slug={product.slug} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <PriceTag
              amount={product.priceUzs}
              compareAt={product.compareAtPriceUzs ?? undefined}
              size="sm"
            />
          </div>
          <AddToCartButton
            slug={product.slug}
            name={product.name}
            disabled={product.available <= 0}
            className="relative z-10 w-full"
          />
        </div>
      </div>
    </article>
  );
}
