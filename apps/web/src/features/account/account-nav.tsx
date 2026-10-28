'use client';

import {
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  PackageIcon,
  PencilRulerIcon,
  UserIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useShopStore } from '@/stores/shop-store';

const items = [
  { href: '/account', key: 'profile', icon: UserIcon },
  { href: '/account/orders', key: 'orders', icon: PackageIcon },
  { href: '/account/builds', key: 'builds', icon: PencilRulerIcon },
  { href: '/account/addresses', key: 'addresses', icon: MapPinIcon },
  { href: '/favorites', key: 'favorites', icon: HeartIcon },
] as const;

export function AccountNav() {
  const t = useTranslations('account.nav');
  const ta = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    // На общем компьютере корзина и избранное прошлого покупателя не должны остаться
    useShopStore.setState({ cart: {}, favorites: [] });
    try {
      sessionStorage.removeItem('redcore-merged-user');
    } catch {
      /* ignore */
    }
    toast.success(ta('signedOut'));
    router.replace('/');
    router.refresh();
  }

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={t('profile')}>
      {items.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-steel-300 hover:bg-white/5 hover:text-foreground',
            pathname === href && 'bg-brand/10 text-foreground',
          )}
        >
          <Icon className="size-4" />
          {t(key)}
        </Link>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 justify-start lg:mt-4"
        onClick={onSignOut}
        data-testid="sign-out"
      >
        <LogOutIcon />
        {ta('signOut')}
      </Button>
    </nav>
  );
}
