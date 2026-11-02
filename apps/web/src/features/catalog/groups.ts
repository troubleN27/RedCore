import type { CategoryInfo } from '@redcore/services';
import {
  BoxIcon,
  CpuIcon,
  KeyboardIcon,
  LaptopIcon,
  MonitorIcon,
  ArmchairIcon,
  type LucideIcon,
} from 'lucide-react';

/**
 * Группы каталога (первый уровень): разделы по slug в порядке показа. Раздел, которого нет
 * в списке (например, новый из консоли), попадает в группу по своему kind — каталог не теряет его.
 */
export const catalogGroups = [
  {
    key: 'components',
    icon: CpuIcon,
    categories: [
      'cpu',
      'gpu',
      'motherboards',
      'memory',
      'storage',
      'power-supplies',
      'cases',
      'cooling',
      'case-fans',
    ],
  },
  {
    key: 'monitors',
    icon: MonitorIcon,
    categories: ['monitors', 'office-monitors', 'monitor-arms'],
  },
  {
    key: 'peripherals',
    icon: KeyboardIcon,
    categories: ['keyboards', 'mice', 'headsets', 'mousepads', 'webcams'],
  },
  { key: 'laptops', icon: LaptopIcon, categories: ['gaming-laptops', 'laptops'] },
  { key: 'furniture', icon: ArmchairIcon, categories: ['gaming-chairs', 'gaming-desks'] },
  { key: 'prebuilt', icon: BoxIcon, categories: ['prebuilt-pcs'] },
] as const satisfies readonly { key: string; icon: LucideIcon; categories: readonly string[] }[];

export type CatalogGroupKey = (typeof catalogGroups)[number]['key'];

const fallbackByKind: Record<CategoryInfo['kind'], CatalogGroupKey> = {
  component: 'components',
  peripheral: 'peripherals',
  prebuilt: 'prebuilt',
};

export interface CatalogGroup {
  key: CatalogGroupKey;
  icon: LucideIcon;
  categories: CategoryInfo[];
}

/** Группы с разделами из снимка каталога; пустые группы не возвращаются. */
export function groupCategories(categories: CategoryInfo[]): CatalogGroup[] {
  const listed = new Set<string>(catalogGroups.flatMap((g) => g.categories));
  return catalogGroups
    .map((group) => {
      const own = group.categories.flatMap((slug) => categories.filter((c) => c.slug === slug));
      const extra = categories.filter(
        (c) => !listed.has(c.slug) && fallbackByKind[c.kind] === group.key,
      );
      return { key: group.key, icon: group.icon, categories: [...own, ...extra] };
    })
    .filter((group) => group.categories.length > 0);
}

export function isCatalogGroupKey(value: string): value is CatalogGroupKey {
  return catalogGroups.some((g) => g.key === value);
}

/** Группа раздела — для хлебных крошек. */
export function groupOfCategory(slug: string, categories: CategoryInfo[]) {
  return groupCategories(categories).find((g) => g.categories.some((c) => c.slug === slug));
}
