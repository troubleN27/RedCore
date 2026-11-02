import type { CatalogSnapshot, ProductSummary } from '@redcore/services/types';
import { hasProductPhoto } from '@/components/brand/product-photos';
import type { CatalogGroupKey } from './groups';

/** Обложки групп каталога — выбраны вручную */
const groupCovers: Record<CatalogGroupKey, string> = {
  components: 'asus-rog-strix-z790-e-gaming-wifi-ii',
  monitors: 'asus-rog-strix-oled-xg27acdng-27-qhd-360-hz',
  peripherals: 'wooting-60he',
  laptops: 'asus-rog-strix-g16-g615lw',
  furniture: 'gtracing-gt099-footrest',
  prebuilt: 'redcore-white-edition',
};

/** Закреплённые обложки разделов; остальные — самый популярный товар раздела с фото */
const categoryCovers: Record<string, string> = {
  'monitor-arms': 'north-bayou-h180-dual-17-32',
  headsets: 'hyperx-cloud-alpha-wireless',
  mousepads: 'logitech-g640-large',
  webcams: 'logitech-c922-pro-stream',
  'gaming-desks': 'cougar-mars-pro-150',
};

const withPhoto = (p: ProductSummary | undefined) => (p && hasProductPhoto(p.slug) ? p : undefined);

export function groupCover(snapshot: CatalogSnapshot, key: CatalogGroupKey) {
  return withPhoto(snapshot.bySlug.get(groupCovers[key]));
}

export function categoryCover(snapshot: CatalogSnapshot, slug: string) {
  const pinned = withPhoto(snapshot.bySlug.get(categoryCovers[slug] ?? ''));
  if (pinned) return pinned;
  return snapshot.products
    .filter((p) => p.categorySlug === slug && hasProductPhoto(p.slug))
    .sort(
      (a, b) =>
        Number(b.available > 0) - Number(a.available > 0) ||
        Number(b.isFeatured) - Number(a.isFeatured) ||
        b.popularity - a.popularity,
    )[0];
}
