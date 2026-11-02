import type { CategoryInfo, ProductSummary } from '@redcore/services/types';
import { ProductArt } from '@/components/brand/product-art';
import { Link } from '@/i18n/navigation';

/** Плитка раздела с фото: страница каталога и страницы групп. */
export function CategoryCard({
  category,
  cover,
}: {
  category: CategoryInfo;
  cover: ProductSummary | undefined;
}) {
  return (
    <Link
      href={`/catalog/${category.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-panel transition-[border-color,box-shadow,transform] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/45 hover:shadow-glow-lg"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
      />
      <div className="relative p-2.5 pb-0">
        <ProductArt
          type={category.componentType}
          brand={cover?.brand ?? ''}
          slug={cover?.slug}
          className="rounded-lg"
        />
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 leading-snug font-medium">{category.name}</p>
      </div>
    </Link>
  );
}
