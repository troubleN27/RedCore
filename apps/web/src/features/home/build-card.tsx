import {
  checkBuild,
  emptyBuild,
  placeProduct,
  type AnyCatalogProduct,
  type PerfIndex,
} from '@redcore/domain';
import type { CategoryInfo, ProductSummary } from '@redcore/services';
import { ArrowRightIcon, CheckCircle2Icon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PriceTag } from '@/components/brand/price-tag';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from '@/i18n/navigation';

const SHOWN_TYPES = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu'];

/** «Сборка недели» в hero — реальная готовая сборка с расчётом совместимости и мощности. */
export function BuildCard({
  prebuilt,
  components,
  categories,
  perf,
}: {
  prebuilt: ProductSummary;
  components: ProductSummary[];
  categories: CategoryInfo[];
  perf: PerfIndex;
}) {
  const t = useTranslations('home.buildCard');
  const tc = useTranslations('common');
  const build = components.reduce(
    (acc, part) => placeProduct(acc, part as AnyCatalogProduct),
    emptyBuild(),
  );
  const check = checkBuild(build, perf);
  const psuW = check.power.psuW ?? check.power.recommendedPsuW;
  const names = new Map(categories.map((c) => [c.componentType, c.name]));
  const shown = SHOWN_TYPES.map((type) => components.find((c) => c.componentType === type)).filter(
    Boolean,
  ) as ProductSummary[];

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-brand/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-graphite-950/80 shadow-panel backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-brushed px-5 py-4">
          <span className="label-caps text-brand-bright">{`${t('label')}: ${prebuilt.name}`}</span>
          {check.status !== 'errors' && (
            <Badge variant="success">
              <CheckCircle2Icon />
              {tc('badges.compatible')}
            </Badge>
          )}
        </div>
        <ul className="divide-y divide-white/5 px-5">
          {shown.map((item) => (
            <li key={item.slug} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="shrink-0 label-caps text-steel-400">
                {names.get(item.componentType)}
              </span>
              <span className="truncate text-right text-sm text-foreground">{item.name}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-white/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3 text-xs text-steel-300">
            <span className="inline-flex items-center gap-1.5">
              <ZapIcon className="size-3.5 text-brand-bright" />
              {t('power')}
            </span>
            <span className="font-mono tabular-nums">
              {t('powerValue', { watts: check.power.loadW, psu: psuW })}
            </span>
          </div>
          <Progress value={check.power.loadPercent ?? 0} aria-label={t('power')} />
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-white/5 bg-black/20 px-5 py-4">
          <div className="space-y-1">
            <span className="label-caps text-steel-400">{t('total')}</span>
            <PriceTag amount={prebuilt.priceUzs} size="md" />
          </div>
          <Link
            href={`/p/${prebuilt.slug}`}
            className="inline-flex items-center gap-1 text-sm text-brand-bright hover:underline"
          >
            {t('open')}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
