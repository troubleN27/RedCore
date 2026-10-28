import type { ProductSummary } from '@redcore/services';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';

export function ProductGrid({
  products,
  chipNames,
  className,
  priorityCount = 4,
}: {
  products: ProductSummary[];
  chipNames: Record<string, string>;
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4', className)}>
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          chipNames={chipNames}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
