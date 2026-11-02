import type { CatalogSnapshot } from '@redcore/services/types';
import { getTranslations } from 'next-intl/server';
import { productPhotoUrl } from '@/components/brand/product-photos';
import { Reveal } from '@/components/motion/reveal';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { groupCover } from './covers';
import { groupCategories } from './groups';

const DOT = '·';

/**
 * Мозаика групп каталога: первая группа — большая плитка 2×2, остальные — обычные.
 * В плитке фото, название группы и ссылки на её разделы.
 */
export async function CatalogMosaic({ snapshot }: { snapshot: CatalogSnapshot }) {
  const t = await getTranslations({ locale: snapshot.locale, namespace: 'catalog' });
  const groups = groupCategories(snapshot.categories);

  return (
    <Reveal stagger className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="catalog-mosaic">
      {groups.map((group, index) => {
        const big = index === 0;
        // На телефоне обычные плитки идут по две: последняя без пары — на всю ширину
        const lonely = !big && index === groups.length - 1 && (groups.length - 1) % 2 === 1;
        const name = t(`groups.${group.key}.name`);
        const cover = groupCover(snapshot, group.key);
        // Единственный раздел в группе (готовые ПК) — сразу в него
        const href =
          group.categories.length > 1
            ? `/catalog/group/${group.key}`
            : `/catalog/${group.categories[0]!.slug}`;
        return (
          <article
            key={group.key}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900 shadow-panel transition-[border-color,box-shadow,transform] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/45 hover:shadow-glow-lg',
              big && 'col-span-2 lg:row-span-2',
              lonely && 'col-span-2 lg:col-span-1',
            )}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
            />
            <div
              className={cn(
                'relative m-2 mb-0 overflow-hidden rounded-xl border border-white/5 bg-graphite-950 sm:m-3 sm:mb-0',
                big ? 'aspect-[16/10] lg:aspect-auto lg:flex-1' : 'aspect-[16/10] lg:aspect-[2/1]',
              )}
            >
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element -- фото заранее сжаты в WebP двух размеров
                <img
                  src={productPhotoUrl(cover.slug, big ? 1200 : 600)}
                  srcSet={`${productPhotoUrl(cover.slug, 600)} 600w, ${productPhotoUrl(cover.slug, 1200)} 1200w`}
                  sizes={
                    big
                      ? '(min-width: 1024px) 820px, calc(100vw - 32px)'
                      : '(min-width: 1024px) 400px, 50vw'
                  }
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-speed group-hover:scale-[1.05]"
                />
              )}
            </div>
            <div className="space-y-2 p-3 sm:p-5">
              <div>
                <h3
                  className={cn(
                    'flex items-center gap-2 font-display font-bold tracking-tight',
                    big ? 'text-xl sm:text-2xl' : 'text-sm sm:text-lg',
                  )}
                >
                  <group.icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-brand-bright sm:size-5"
                  />
                  <Link
                    href={href}
                    aria-label={t('openGroup', { name })}
                    className="after:absolute after:inset-0 after:z-0 hover:text-white"
                  >
                    {name}
                  </Link>
                </h3>
              </div>
              {group.categories.length > 1 && (
                <p className="relative z-10 flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-steel-300">
                  {group.categories.map((category, i) => (
                    // Точка — после пункта: при переносе она остаётся в конце строки
                    <span key={category.slug} className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/catalog/${category.slug}`}
                        className="transition-colors hover:text-brand-bright"
                      >
                        {category.name}
                      </Link>
                      {i < group.categories.length - 1 && (
                        <span aria-hidden="true" className="text-steel-400">
                          {DOT}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </Reveal>
  );
}
