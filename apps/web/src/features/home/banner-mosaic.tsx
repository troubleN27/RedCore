import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/motion/reveal';

/**
 * Баннеры «Новинки и бренды» мозаикой: первый — большой (2×2 клетки), остальные четыре вокруг.
 * Файлы `/banners/<file>-800.webp` и `-1600.webp`; каждый баннер ведёт в свою категорию.
 * Клетки 16:9, поэтому большой баннер тоже 16:9 и картинки не обрезаются.
 */
const banners: {
  key: 'wooting' | 'gpu' | 'monitor' | 'headset' | 'mouse';
  file: string;
  href: string;
}[] = [
  { key: 'gpu', file: 'rtx-5090', href: '/catalog/gpu' },
  { key: 'wooting', file: 'wooting-80he', href: '/catalog/keyboards' },
  { key: 'monitor', file: 'oled-monitor', href: '/catalog/monitors' },
  { key: 'headset', file: 'headset', href: '/catalog/headsets' },
  { key: 'mouse', file: 'mouse', href: '/catalog/mice' },
];

export function BannerMosaic() {
  const t = useTranslations('home.banners');

  return (
    <Reveal stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {banners.map((banner, i) => {
        const big = i === 0;
        return (
          <Link
            key={banner.key}
            href={banner.href}
            className={cn(
              'group relative block overflow-hidden rounded-2xl border border-white/10 bg-graphite-950 shadow-panel transition-[border-color,box-shadow] duration-300 hover:border-brand/60 hover:shadow-glow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright',
              big && 'col-span-2 lg:row-span-2',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- баннеры заранее сжаты в WebP двух размеров */}
            <img
              src={`/banners/${banner.file}-1600.webp`}
              srcSet={`/banners/${banner.file}-800.webp 800w, /banners/${banner.file}-1600.webp 1600w`}
              sizes={
                big
                  ? '(min-width: 1280px) 616px, (min-width: 1024px) 50vw, calc(100vw - 32px)'
                  : '(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw'
              }
              alt={t(`slides.${banner.key}`)}
              loading="lazy"
              decoding="async"
              className={cn(
                'aspect-[43/24] size-full object-cover transition-transform duration-500 ease-speed group-hover:scale-[1.03]',
                // Большой баннер растягивается на две строки сетки (с промежутком между ними)
                big && 'lg:aspect-auto',
              )}
            />
          </Link>
        );
      })}
    </Reveal>
  );
}
