import type { ComponentType } from '@redcore/domain';
import {
  Box,
  CircuitBoard,
  Computer,
  Cpu,
  Fan,
  Gpu,
  HardDrive,
  Headphones,
  Keyboard,
  MemoryStick,
  Monitor,
  Mouse,
  PlugZap,
  Square,
  Webcam,
  Wind,
  type LucideIcon,
  Armchair,
  LampDesk,
  Laptop,
  MonitorUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasProductPhoto, productPhotoUrl } from './product-photos';

export const componentIcons: Record<ComponentType, LucideIcon> = {
  cpu: Cpu,
  gpu: Gpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  storage: HardDrive,
  psu: PlugZap,
  case: Box,
  cooler: Fan,
  case_fan: Wind,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headphones,
  mousepad: Square,
  webcam: Webcam,
  laptop: Laptop,
  monitor_arm: MonitorUp,
  chair: Armchair,
  desk: LampDesk,
  prebuilt: Computer,
};

/** Ширина картинки в вёрстке — по ней браузер выбирает 600 или 1200 px */
const photoSizes = {
  sm: '64px',
  md: '(min-width: 1280px) 300px, (min-width: 640px) 33vw, 50vw',
  lg: '(min-width: 1024px) 640px, calc(100vw - 32px)',
};

/**
 * Обложка товара: фото на фирменном фоне, если оно есть, иначе — иконка типа на карбоне
 * с красным свечением и брендом.
 */
export function ProductArt({
  type,
  brand,
  slug,
  alt = '',
  priority = false,
  className,
  size = 'md',
}: {
  type: ComponentType;
  brand: string;
  slug?: string;
  alt?: string;
  /** Главная картинка экрана (LCP): грузится сразу */
  priority?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (hasProductPhoto(slug)) {
    return (
      <div
        className={cn(
          'relative aspect-[4/3] overflow-hidden rounded-lg border border-white/5 bg-graphite-950',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- фото заранее сжаты в WebP двух размеров */}
        <img
          src={productPhotoUrl(slug, size === 'sm' ? 600 : 1200)}
          srcSet={`${productPhotoUrl(slug, 600)} 600w, ${productPhotoUrl(slug, 1200)} 1200w`}
          sizes={photoSizes[size]}
          alt={alt}
          width={1200}
          height={900}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          className="size-full object-cover transition-transform duration-500 ease-speed group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  const Icon = componentIcons[type];
  return (
    <div
      className={cn(
        'relative isolate flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-carbon',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_45%,rgb(212_0_0/0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-6 bottom-6 -z-10 h-px bg-linear-to-r from-transparent via-brand-bright/60 to-transparent"
      />
      <Icon
        aria-hidden="true"
        strokeWidth={1.25}
        className={cn(
          'text-metal drop-shadow-[0_0_18px_rgb(255_40_0/0.35)] transition-transform duration-500 ease-speed group-hover:scale-110',
          size === 'sm' && 'size-12',
          size === 'md' && 'size-14 sm:size-20',
          size === 'lg' && 'size-36',
        )}
      />
      <span className="absolute top-3 left-3 label-caps text-steel-400">{brand}</span>
    </div>
  );
}
