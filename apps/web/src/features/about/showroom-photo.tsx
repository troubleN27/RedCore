import { cn } from '@/lib/utils';

/** Фото шоурума в окне со свечением: `/about/showroom-960.webp` и `-1600.webp`. */
export function ShowroomPhoto({
  alt,
  sizes,
  priority = false,
  className,
}: {
  alt: string;
  sizes: string;
  /** На странице «О компании» фото — первый экран: грузим сразу */
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      {/* Свечение не шире боковых отступов, иначе на телефоне появляется прокрутка вбок */}
      <div
        aria-hidden="true"
        className="absolute -inset-3 rounded-[2rem] bg-brand/15 blur-3xl sm:-inset-6"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-graphite-950 shadow-panel">
        {/* eslint-disable-next-line @next/next/no-img-element -- фото заранее сжато в WebP двух размеров */}
        <img
          src="/about/showroom-1600.webp"
          srcSet="/about/showroom-960.webp 960w, /about/showroom-1600.webp 1600w"
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="aspect-[43/24] w-full object-cover"
        />
      </div>
    </div>
  );
}
