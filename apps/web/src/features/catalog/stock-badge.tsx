import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

const LOW_STOCK = 3;

export function StockBadge({ available }: { available: number }) {
  const t = useTranslations('common.stock');
  if (available <= 0) return <Badge variant="secondary">{t('outOfStock')}</Badge>;
  if (available <= LOW_STOCK)
    return <Badge variant="warning">{t('lowStock', { count: available })}</Badge>;
  return <Badge variant="success">{t('inStock')}</Badge>;
}
