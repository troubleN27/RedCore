'use client';

import {
  GitCompareArrowsIcon,
  HeartIcon,
  SearchIcon,
  ShoppingCartIcon,
  UserIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useShopStore } from '@/stores/shop-store';
import { useStoreHydrated } from '@/stores/store-hydrator';

function CountLink({
  href,
  label,
  icon: Icon,
  count,
  className,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  count: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}: ${count}` : label}
      title={label}
      className={cn(
        'relative inline-flex size-9 items-center justify-center rounded-md text-steel-300 transition-colors hover:bg-white/5 hover:text-foreground',
        className,
      )}
    >
      <Icon className="size-[18px]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 font-bold text-white tabular-nums shadow-glow-sm">
          {count}
        </span>
      )}
    </Link>
  );
}

export function HeaderActions() {
  const t = useTranslations('shop.header');
  const ts = useTranslations('shop.search');
  const hydrated = useStoreHydrated();
  const favorites = useShopStore((s) => s.favorites.length);
  const compare = useShopStore((s) => s.compare.slugs.length);
  const cart = useShopStore((s) => Object.values(s.cart).reduce((sum, qty) => sum + qty, 0));
  const tn = useTranslations('nav');
  const ta = useTranslations('auth');
  const { data: session } = useSession();

  return (
    <div className="flex items-center">
      <CountLink
        href="/search"
        label={ts('open')}
        icon={SearchIcon}
        count={0}
        className="lg:hidden"
      />
      <CountLink
        href="/compare"
        label={t('compare')}
        icon={GitCompareArrowsIcon}
        count={hydrated ? compare : 0}
        className="hidden sm:inline-flex"
      />
      <CountLink
        href="/favorites"
        label={t('favorites')}
        icon={HeartIcon}
        count={hydrated ? favorites : 0}
        className="hidden sm:inline-flex"
      />
      <CountLink
        href="/cart"
        label={t('cart')}
        icon={ShoppingCartIcon}
        count={hydrated ? cart : 0}
      />
      <CountLink
        href={session ? '/account' : '/login'}
        label={session ? tn('account') : ta('signIn')}
        icon={session ? UserRoundCheckIcon : UserIcon}
        count={0}
      />
    </div>
  );
}
