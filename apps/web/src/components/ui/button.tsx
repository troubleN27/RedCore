import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

// Фирменные варианты: primary — градиент Rosso Corsa со свечением и бликом-«пролётом»,
// destructive сознательно отличается от брендового красного (контур + полупрозрачная заливка).
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md text-sm font-semibold tracking-wide whitespace-nowrap transition-[background-color,box-shadow,color,border-color,transform] duration-200 ease-speed outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/60 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-cta text-white shadow-glow-sm before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1/3 before:-translate-x-[120%] before:skew-x-[-20deg] before:bg-white/25 hover:shadow-glow hover:before:animate-shine',
        destructive:
          'border border-danger/45 bg-danger/12 text-danger hover:bg-danger/20 focus-visible:ring-danger/40',
        outline:
          'border border-graphite-700 bg-transparent text-foreground hover:border-brand-bright/60 hover:bg-white/[0.03] hover:text-white',
        secondary:
          'border border-graphite-800 bg-graphite-850 text-foreground hover:border-graphite-700 hover:bg-graphite-800',
        ghost: 'text-steel-300 hover:bg-white/5 hover:text-foreground',
        link: 'text-brand-bright underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 has-[>svg]:px-4',
        xs: "h-6 gap-1 rounded px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5',
        lg: 'h-12 px-7 text-base has-[>svg]:px-6',
        icon: 'size-10',
        'icon-xs': "size-6 rounded [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
