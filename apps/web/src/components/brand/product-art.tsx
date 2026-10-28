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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  prebuilt: Computer,
};

/**
 * Фирменная обложка товара, пока у демо-каталога нет фотографий (их загружают в админке,
 * этап 5): иконка типа на карбоне с красным свечением и брендом.
 */
export function ProductArt({
  type,
  brand,
  className,
  size = 'md',
}: {
  type: ComponentType;
  brand: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
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
