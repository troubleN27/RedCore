'use client';

import { ChevronDownIcon, MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Link } from '@/i18n/navigation';
import { groupHref, type MenuGroup } from './catalog-menu';
import { LocaleSwitcher } from './locale-switcher';
import { navItems } from './nav-items';

// Разделы из иконок шапки, которые на узком экране не помещаются
const secondaryItems = [
  { href: '/favorites', key: 'favorites' },
  { href: '/compare', key: 'compare' },
] as const;

export function MobileNav({ groups }: { groups: MenuGroup[] }) {
  const t = useTranslations('nav');
  const tk = useTranslations('catalog');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label={t('openMenu')}>
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 border-graphite-800 bg-graphite-950">
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
          <SheetDescription className="sr-only">{t('mainNavigation')}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t('mainNavigation')} className="flex flex-col gap-1 px-4">
          {navItems.map((item) =>
            item.key === 'catalog' && groups.length > 0 ? (
              // Каталог раскрывается списком групп с переходом сразу в нужный раздел
              <details key={item.href} className="group/catalog">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-3 text-base font-medium text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground [&::-webkit-details-marker]:hidden">
                  {t(item.key)}
                  <ChevronDownIcon className="size-4 transition-transform group-open/catalog:rotate-180" />
                </summary>
                <div className="space-y-3 pt-1 pb-3 pl-3">
                  {groups.map((group) => (
                    <div key={group.key}>
                      <Link
                        href={groupHref(group)}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-1.5 label-caps text-brand-bright"
                      >
                        {tk(`groups.${group.key}.name`)}
                      </Link>
                      {group.categories.length > 1 &&
                        group.categories.map((category) => (
                          <Link
                            key={category.slug}
                            href={`/catalog/${category.slug}`}
                            onClick={() => setOpen(false)}
                            className="block rounded-md px-3 py-1.5 text-sm text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground"
                          >
                            {category.name}
                          </Link>
                        ))}
                    </div>
                  ))}
                  <Link
                    href="/catalog"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-1.5 text-sm text-brand-bright"
                  >
                    {tk('allCatalog')}
                  </Link>
                </div>
              </details>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {t(item.key)}
              </Link>
            ),
          )}
          <div className="my-2 border-t border-white/5" />
          {secondaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4 p-4">
          <LocaleSwitcher className="self-start" />
          <Button asChild size="lg">
            <Link href="/configurator" onClick={() => setOpen(false)}>
              {tc('actions.buildPc')}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
