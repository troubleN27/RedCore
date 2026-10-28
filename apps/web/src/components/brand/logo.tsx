import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Знак: красный «спидовый» параллелограмм и металлический шеврон. */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('size-7 drop-shadow-[0_0_10px_rgb(255_40_0/0.45)]', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2800" />
          <stop offset="1" stopColor="#a80000" />
        </linearGradient>
      </defs>
      <path d="M3 27 13.5 5H22L11.5 27Z" fill={`url(#${gradientId})`} />
      <path d="M15.5 27 21.5 14.5H29L23 27Z" fill="#f5f5f7" fillOpacity="0.92" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-lg leading-none font-bold tracking-tight">
        <span className="text-brand-bright">RED</span>
        <span className="text-foreground">CORE</span>
      </span>
    </span>
  );
}
