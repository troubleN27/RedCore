import { formatPrice } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PriceTagProps {
  /** Текущая цена в сумах */
  amount: number;
  /** Цена до скидки — показывается зачёркнутой вместе с бейджем скидки */
  compareAt?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'text-[13px] sm:text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

export function PriceTag({ amount, compareAt, size = 'md', className }: PriceTagProps) {
  const locale = useLocale();
  const t = useTranslations('common.price');
  const hasDiscount = compareAt !== undefined && compareAt > amount;
  const percent = hasDiscount ? Math.round((1 - amount / compareAt) * 100) : 0;

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
      <span className={cn('font-display font-bold tabular-nums', sizes[size])}>
        {formatPrice(amount, locale)}
      </span>
      {hasDiscount && (
        <>
          <span className="text-sm text-steel-400 tabular-nums line-through">
            {formatPrice(compareAt, locale)}
          </span>
          <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
            {t('discount', { percent })}
          </span>
        </>
      )}
    </div>
  );
}
