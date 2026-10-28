import { ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations('catalog');
  const all: Crumb[] = [{ label: t('home'), href: '/' }, ...items];
  return (
    <nav aria-label={t('breadcrumbs')} className="text-xs text-steel-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRightIcon aria-hidden="true" className="size-3 text-graphite-700" />
            )}
            {crumb.href && index < all.length - 1 ? (
              <Link href={crumb.href} className="transition-colors hover:text-brand-bright">
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={index === all.length - 1 ? 'page' : undefined}
                className="text-steel-300"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** JSON-LD BreadcrumbList для поисковиков. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
