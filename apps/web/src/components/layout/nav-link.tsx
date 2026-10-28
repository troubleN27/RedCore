'use client';

import type { ComponentProps } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type NavLinkProps = ComponentProps<typeof Link> & { href: string };

/** Ссылка шапки: активный раздел подсвечивается красной «гоночной» полосой. */
export function NavLink({ href, className, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative rounded-md px-3 py-2 text-sm font-medium text-steel-300 transition-colors duration-200 hover:text-foreground',
        isActive && 'text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-3 -bottom-px h-0.5 origin-left scale-x-0 rounded-full bg-brand-bright shadow-glow-sm transition-transform duration-300 ease-speed group-hover:scale-x-100',
          isActive && 'scale-x-100',
        )}
      />
    </Link>
  );
}
