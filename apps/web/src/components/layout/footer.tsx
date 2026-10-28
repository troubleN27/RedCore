import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';
import { navItems } from './nav-items';

const helpKeys = ['delivery', 'payment', 'warranty', 'returns', 'credits'] as const;

export function Footer() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-white/5 bg-carbon">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand/50 to-transparent"
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="space-y-4 md:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-steel-300">{tc('tagline')}</p>
          <p className="max-w-sm text-xs text-steel-400">{t('demo')}</p>
        </div>

        <div className="space-y-4">
          <h2 className="label-caps text-steel-400">{t('shop')}</h2>
          <ul className="space-y-2 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-steel-300 transition-colors hover:text-brand-bright"
                >
                  {tn(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="label-caps text-steel-400">{t('help')}</h2>
          <ul className="space-y-2 text-sm text-steel-300">
            {helpKeys.map((key) => (
              <li key={key}>
                {key === 'credits' ? (
                  <Link href="/credits" className="hover:text-foreground">
                    {t(key)}
                  </Link>
                ) : (
                  t(key)
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-steel-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{t('rights', { year })}</p>
          <p className="flex flex-wrap gap-x-2">
            <span>{t('address')}</span>
            <span aria-hidden="true" className="text-graphite-700">
              /
            </span>
            <span>{t('hours')}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
