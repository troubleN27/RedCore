import type { ProductSummary } from '@redcore/services';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';
import { Reveal } from '@/components/motion/reveal';

export function ProductGrid({
  products,
  chipNames,
  className,
  priorityCount = 4,
  reveal = false,
  scrollOnMobile = false,
}: {
  products: ProductSummary[];
  chipNames: Record<string, string>;
  className?: string;
  priorityCount?: number;
  /** Карточки появляются по очереди при прокрутке (главная, подборки) */
  reveal?: boolean;
  /** На телефоне — лента с прокруткой вбок вместо длинной сетки */
  scrollOnMobile?: boolean;
}) {
  const Grid = reveal ? Reveal : 'div';
  return (
    <Grid
      {...(reveal ? { stagger: true } : {})}
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4',
        scrollOnMobile &&
          '-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 [&>*]:w-[46%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[38%] md:[&>*]:w-auto',
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          chipNames={chipNames}
          priority={index < priorityCount}
        />
      ))}
    </Grid>
  );
}
