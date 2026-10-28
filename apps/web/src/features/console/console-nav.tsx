'use client';

import {
  BarChart3Icon,
  BotIcon,
  BoxesIcon,
  CreditCardIcon,
  Gamepad2Icon,
  ExternalLinkIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  PackageIcon,
  PlugIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TicketPercentIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staffLogoutAction } from '@/server/console-auth-actions';
import { ConsoleLink, useConsoleHref } from './console-base';

export type NavSection =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'stock'
  | 'reviews'
  | 'promos'
  | 'games'
  | 'ai'
  | 'payments'
  | 'users'
  | 'settings'
  | 'mcp'
  | 'audit';

const icons: Record<NavSection, LucideIcon> = {
  dashboard: BarChart3Icon,
  orders: ShoppingBagIcon,
  products: PackageIcon,
  stock: BoxesIcon,
  reviews: MessageSquareTextIcon,
  promos: TicketPercentIcon,
  games: Gamepad2Icon,
  ai: BotIcon,
  payments: CreditCardIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  mcp: PlugIcon,
  audit: ScrollTextIcon,
};

export function ConsoleNav({
  sections,
  staff,
}: {
  sections: NavSection[];
  staff: { name: string; email: string; role: 'admin' | 'manager' };
}) {
  const t = useTranslations('console');
  const pathname = usePathname();
  const router = useRouter();
  const href = useConsoleHref();

  return (
    <aside className="flex flex-col gap-6 border-b border-white/5 bg-graphite-950 p-4 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
      <Logo />
      <nav
        className="flex gap-1 overflow-x-auto lg:flex-col"
        aria-label={t('meta.title')}
        data-testid="console-nav"
      >
        {sections.map((section) => {
          const path = section === 'dashboard' ? '/' : `/${section}`;
          const full = href(path);
          const active = section === 'dashboard' ? pathname === full : pathname.startsWith(full);
          const Icon = icons[section];
          return (
            <ConsoleLink
              key={section}
              href={path}
              data-section={section}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground',
                active && 'bg-brand/10 text-foreground',
              )}
            >
              <Icon className="size-4" />
              {t(`nav.${section}`)}
            </ConsoleLink>
          );
        })}
      </nav>
      <div className="mt-auto hidden space-y-3 lg:block">
        <div className="text-xs">
          <p className="truncate font-medium text-foreground">{staff.name}</p>
          <p className="truncate text-steel-400">{`${staff.email} · ${t(`roles.${staff.role}`)}`}</p>
        </div>
        <NextLink
          href="/"
          className="flex items-center gap-2 text-xs text-steel-400 hover:text-foreground"
        >
          <ExternalLinkIcon className="size-3.5" />
          {t('nav.toStore')}
        </NextLink>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          data-testid="staff-logout"
          onClick={async () => {
            await staffLogoutAction();
            router.replace(href('/login'));
            router.refresh();
          }}
        >
          <LogOutIcon />
          {t('nav.logout')}
        </Button>
      </div>
    </aside>
  );
}
