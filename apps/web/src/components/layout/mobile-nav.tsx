'use client';

import { MenuIcon } from 'lucide-react';
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
import { LocaleSwitcher } from './locale-switcher';
import { navItems } from './nav-items';

// Разделы из иконок шапки, которые на узком экране не помещаются
const secondaryItems = [
  { href: '/favorites', key: 'favorites' },
  { href: '/compare', key: 'compare' },
] as const;

export function MobileNav() {
  const t = useTranslations('nav');
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-medium text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {t(item.key)}
            </Link>
          ))}
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
