import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { SearchBox } from '@/features/search/search-box';
import { Link } from '@/i18n/navigation';
import { HeaderActions } from './header-actions';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { navItems } from './nav-items';
import { NavLink } from './nav-link';

export function Header() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');

  return (
    <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <Link href="/" aria-label={tc('brand')} className="shrink-0 rounded-md">
          <Logo />
        </Link>

        <nav aria-label={t('mainNavigation')} className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <Suspense>
          <SearchBox className="hidden max-w-md flex-1 lg:block" />
        </Suspense>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <HeaderActions />
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/configurator">{tc('actions.buildPc')}</Link>
          </Button>
          <MobileNav />
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
