'use client';

import type { PcComponentType } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { Trash2Icon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PriceTag } from '@/components/brand/price-tag';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AddBuildToCartButton, SaveShareActions } from './build-actions';
import { BuildStatusLabel, IssueList, PowerMeter } from './compat-view';
import type { BuildState } from './use-build';

export function BuildSummary({
  state,
  savedId,
  onSlotClick,
  onRemove,
  onSaved,
  onClear,
}: {
  state: BuildState;
  savedId: string | null;
  onSlotClick: (slot: PcComponentType) => void;
  onRemove: (slot: PcComponentType, slug: string) => void;
  onSaved: (publicId: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('configurator');
  const locale = useLocale();
  const { check, lines } = state;
  const missing = check.missing.map((slot) => t(`slots.${slot}`)).join(', ');

  return (
    <section
      id="build-summary"
      aria-labelledby="summary-title"
      data-testid="build-summary"
      className="overflow-hidden rounded-2xl border border-white/10 bg-graphite-950/80 shadow-panel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-brushed px-5 py-4">
        <h2 id="summary-title" className="label-caps text-brand-bright">
          {t('summary.title')}
        </h2>
        {lines.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              if (window.confirm(t('actions.clearConfirm'))) onClear();
            }}
          >
            <Trash2Icon />
            {t('actions.clear')}
          </Button>
        )}
      </div>

      <div className="space-y-5 p-5">
        <BuildStatusLabel status={check.status} />

        {lines.length === 0 ? (
          <p className="text-sm text-steel-300">{t('summary.empty')}</p>
        ) : (
          <ul className="divide-y divide-white/5" data-testid="summary-lines">
            {lines.map((line) => (
              <li key={`${line.slot}-${line.product.slug}`} className="flex items-start gap-2 py-2">
                <button
                  type="button"
                  onClick={() => onSlotClick(line.slot)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block label-caps text-steel-400">{t(`slots.${line.slot}`)}</span>
                  <span className="block truncate text-sm hover:text-white">
                    {line.qty > 1
                      ? `${line.product.name} ${t('share.qty', { qty: line.qty })}`
                      : line.product.name}
                  </span>
                </button>
                <span className="shrink-0 pt-4 font-mono text-xs text-steel-300 tabular-nums">
                  {formatPrice(line.product.priceUzs * line.qty, locale)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="mt-3.5"
                  aria-label={`${t('actions.remove')}: ${line.product.name}`}
                  onClick={() => onRemove(line.slot, line.product.slug)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {check.missing.length > 0 && lines.length > 0 && (
          <p className="text-xs text-steel-300" data-testid="missing-slots">
            {t('summary.missing', { slots: missing })}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t('summary.checkTitle')}</h3>
          {check.issues.length === 0 ? (
            <p className="text-sm text-steel-300">{t('summary.noIssues')}</p>
          ) : (
            <IssueList issues={check.issues} onSlotClick={onSlotClick} />
          )}
        </div>

        {lines.length > 0 && (
          <>
            <Separator className="bg-white/5" />
            <PowerMeter power={check.power} />
            <p className="text-xs text-steel-400">{t('power.hint')}</p>
          </>
        )}
      </div>

      <div className="space-y-4 border-t border-white/5 bg-black/20 p-5">
        <div className="flex items-end justify-between gap-3">
          <span className="label-caps text-steel-400">{t('summary.total')}</span>
          <PriceTag amount={check.totalUzs} size="lg" className="justify-end" />
        </div>
        <AddBuildToCartButton
          className="w-full"
          publicId={savedId ?? undefined}
          lines={lines.map((l) => ({
            slug: l.product.slug,
            name: l.product.name,
            qty: l.qty,
            available: l.product.available,
          }))}
        />
        <SaveShareActions
          items={state.items.map(({ slug, qty }) => ({ slug, qty }))}
          savedId={savedId}
          onSaved={onSaved}
        />
      </div>
    </section>
  );
}
