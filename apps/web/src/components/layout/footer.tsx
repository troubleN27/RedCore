import { MapPinIcon, PhoneIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { InstagramIcon, TelegramIcon, YouTubeIcon } from '@/components/brand/social-icons';
import { Link } from '@/i18n/navigation';
import { navItems } from './nav-items';

const helpKeys = ['delivery', 'payment', 'warranty', 'returns'] as const;
const companyLinks = [
  { key: 'about', href: '/about' },
  { key: 'contacts', href: '/contacts' },
  { key: 'why', href: '/why-redcore' },
  { key: 'offer', href: '/offer' },
  { key: 'privacy', href: '/privacy' },
] as const;
/** Те же номера, что на странице «Контакты» */
const phones = [
  { key: 'sales', number: '+998 71 000-00-01' },
  { key: 'service', number: '+998 71 000-00-02' },
  { key: 'orders', number: '+998 71 000-00-03' },
] as const;
/** Пока ведут на главные страницы соцсетей — заменить на адреса аккаунтов магазина */
const socials = [
  { key: 'instagram', href: 'https://www.instagram.com/', icon: InstagramIcon },
  { key: 'youtube', href: 'https://www.youtube.com/', icon: YouTubeIcon },
  { key: 'telegram', href: 'https://telegram.org/', icon: TelegramIcon },
] as const;

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
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] lg:px-8 xl:grid-cols-6">
        <div className="space-y-4 sm:col-span-2 md:col-span-4 xl:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-steel-300">{tc('tagline')}</p>
          <div className="space-y-3 pt-2">
            <p className="label-caps text-steel-400">{t('socialTitle')}</p>
            <ul className="flex gap-3">
              {socials.map(({ key, href, icon: SocialIcon }) => (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(`social.${key}`)}
                    title={t(`social.${key}`)}
                    className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-steel-300 transition-[color,background-color,border-color,box-shadow] hover:border-brand hover:bg-brand hover:text-white hover:shadow-glow-sm"
                  >
                    <SocialIcon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="label-caps text-steel-400">{t('company')}</h2>
          <ul className="space-y-2 text-sm">
            {companyLinks.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="text-steel-300 transition-colors hover:text-brand-bright"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
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
                <Link href={`/help/${key}`} className="hover:text-foreground">
                  {t(key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/faq" className="hover:text-foreground">
                {t('faq')}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="label-caps text-steel-400">{t('phonesTitle')}</h2>
          <ul className="space-y-3 text-sm">
            {phones.map((phone) => (
              <li key={phone.key} className="flex items-start gap-2">
                <PhoneIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
                <span>
                  <span className="block text-xs text-steel-400">{t(`phones.${phone.key}`)}</span>
                  <span className="whitespace-nowrap text-steel-300 tabular-nums">
                    {phone.number}
                  </span>
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand-bright" />
              <span>
                <span className="block text-xs text-steel-400">{t('showroom')}</span>
                <Link href="/contacts" className="text-steel-300 hover:text-foreground">
                  {t('showroomAddress')}
                </Link>
              </span>
            </li>
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
