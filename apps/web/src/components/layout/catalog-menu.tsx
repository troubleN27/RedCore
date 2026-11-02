'use client';

import { ArrowRightIcon, ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { componentIcons } from '@/components/brand/product-art';
import { catalogGroups, type CatalogGroupKey } from '@/features/catalog/groups';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export interface MenuGroup {
  key: CatalogGroupKey;
  categories: {
    slug: string;
    name: string;
    componentType: keyof typeof componentIcons;
  }[];
}

/** Задержка закрытия: курсор успевает дойти от кнопки до панели */
const CLOSE_DELAY_MS = 150;

const groupIcon = (key: CatalogGroupKey) => catalogGroups.find((g) => g.key === key)!.icon;
export const groupHref = (group: MenuGroup) =>
  group.categories.length === 1
    ? `/catalog/${group.categories[0]!.slug}`
    : `/catalog/group/${group.key}`;

/** Пункт «Каталог» в шапке: при наведении или нажатии открывает панель со всеми разделами. */
export function CatalogMenu({ groups }: { groups: MenuGroup[] }) {
  const t = useTranslations('catalog');
  const tn = useTranslations('nav');
  const pathname = usePathname();
  // Открыто для конкретной страницы: после перехода по ссылке панель закрывается сама
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const closeTimer = useRef<number | undefined>(undefined);
  const active = pathname === '/catalog' || pathname.startsWith('/catalog/');

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div onPointerEnter={show} onPointerLeave={hide}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="catalog-menu"
        className={cn(
          'group relative inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-steel-300 transition-colors duration-200 hover:text-foreground',
          (active || open) && 'text-foreground',
        )}
      >
        {tn('catalog')}
        <ChevronDownIcon
          className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-3 -bottom-px h-0.5 origin-left scale-x-0 rounded-full bg-brand-bright shadow-glow-sm transition-transform duration-300 ease-speed group-hover:scale-x-100',
            (active || open) && 'scale-x-100',
          )}
        />
      </button>

      <div
        id="catalog-menu"
        role="region"
        aria-label={t('menuLabel')}
        hidden={!open}
        className="absolute inset-x-0 top-full border-y border-white/5 bg-graphite-950 shadow-2xl"
      >
        <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-6 px-8 py-8 md:grid-cols-3">
          {groups.map((group) => {
            const Icon = groupIcon(group.key);
            return (
              <div key={group.key} className="space-y-3">
                <Link
                  href={groupHref(group)}
                  className="flex items-center gap-2 label-caps text-brand-bright hover:underline"
                >
                  <Icon className="size-4" />
                  {t(`groups.${group.key}.name`)}
                </Link>
                <ul className="space-y-0.5">
                  {group.categories.map((category) => {
                    const CategoryIcon = componentIcons[category.componentType];
                    return (
                      <li key={category.slug}>
                        <Link
                          href={`/catalog/${category.slug}`}
                          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground"
                        >
                          <CategoryIcon className="size-4 shrink-0 text-steel-400" />
                          <span className="flex-1 truncate">{category.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto max-w-7xl px-8 py-3">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1 text-sm text-brand-bright hover:underline"
            >
              {t('allCatalog')}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
