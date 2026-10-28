import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

// Бейджи — мелкие капс-подписи в стиле моторспорта. Брендовый красный — только для
// акцентов (Хит, Новинка); статусы совместимости и наличия — семантическими цветами.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-brand/40 bg-brand-deep text-brand-bright',
        solid: 'border-transparent bg-brand text-white shadow-glow-sm',
        secondary: 'border-graphite-700 bg-graphite-850 text-steel-300',
        outline: 'border-graphite-700 text-foreground',
        metal: 'border-metal-dark/60 bg-metal/10 text-metal',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        danger: 'border-danger/35 bg-danger/10 text-danger',
        info: 'border-info/30 bg-info/10 text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
