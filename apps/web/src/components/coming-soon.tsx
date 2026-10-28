import { ConstructionIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NavKey } from '@/components/layout/nav-items';
import { Link } from '@/i18n/navigation';

/** Заглушка раздела, который появится на следующих этапах плана. */
export function ComingSoon({ section }: { section: NavKey | 'cart' }) {
  const t = useTranslations('comingSoon');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand-deep text-brand-bright shadow-glow-sm">
        <ConstructionIcon className="size-6" />
      </span>
      <Badge>{t('badge')}</Badge>
      <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {t('title', { section: tn(section) })}
      </h1>
      <p className="max-w-md text-steel-300">{t('text')}</p>
      <Button asChild variant="outline">
        <Link href="/">{tc('actions.toHome')}</Link>
      </Button>
    </section>
  );
}
