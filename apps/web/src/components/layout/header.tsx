import { isLocale } from '@redcore/i18n';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { groupCategories } from '@/features/catalog/groups';
import { SearchBox } from '@/features/search/search-box';
import { Link } from '@/i18n/navigation';
import { getSnapshot } from '@/server/catalog';
import { CatalogMenu, type MenuGroup } from './catalog-menu';
import { HeaderActions } from './header-actions';
import { HomeLink } from './home-link';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { navItems } from './nav-items';
import { NavLink } from './nav-link';

/** Группы и разделы каталога для меню «Каталог» и мобильного меню */
async function loadMenuGroups(): Promise<MenuGroup[]> {
  const locale = await getLocale();
  if (!isLocale(locale)) return [];
  const snapshot = await getSnapshot(locale);
  return groupCategories(snapshot.categories).map((group) => ({
    key: group.key,
    categories: group.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      componentType: c.componentType,
    })),
  }));
}

export async function Header() {
  const [t, tc, menuGroups] = await Promise.all([
    getTranslations('nav'),
    getTranslations('common'),
    loadMenuGroups(),
  ]);

  return (
    <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <HomeLink aria-label={tc('brand')} className="shrink-0 rounded-md">
          <Logo />
        </HomeLink>

        <nav aria-label={t('mainNavigation')} className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) =>
            item.key === 'catalog' ? (
              <CatalogMenu key={item.href} groups={menuGroups} />
            ) : (
              <NavLink key={item.href} href={item.href}>
                {t(item.key)}
              </NavLink>
            ),
          )}
        </nav>

        <Suspense>
          <SearchBox className="hidden max-w-md min-w-44 flex-1 lg:block" />
        </Suspense>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <HeaderActions />
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/configurator">{tc('actions.buildPc')}</Link>
          </Button>
          <MobileNav groups={menuGroups} />
        </div>
      </div>
      {/* Тонкая красная «линия разгона» под шапкой */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-linear-to-r from-transparent via-brand/70 to-transparent"
      />
    </header>
  );
}
