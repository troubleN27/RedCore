'use client';

import { Link, usePathname } from '@/i18n/navigation';

function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * Ссылка на главную из шапки. На самой главной переход по той же ссылке ничего не делает —
 * поэтому там она плавно прокручивает страницу в начало.
 */
export function HomeLink({ children, ...props }: Omit<React.ComponentProps<typeof Link>, 'href'>) {
  const pathname = usePathname();

  return (
    <Link
      {...props}
      href="/"
      onClick={(e) => {
        props.onClick?.(e);
        if (pathname !== '/' || e.defaultPrevented) return;
        e.preventDefault();
        scrollToTop();
      }}
    >
      {children}
    </Link>
  );
}
