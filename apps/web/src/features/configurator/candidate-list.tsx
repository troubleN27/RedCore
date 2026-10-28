'use client';

import {
  checkCandidate,
  isListSlot,
  normalizeSearchText,
  type CompatIssue,
  type PcComponentType,
  type PerfIndex,
} from '@redcore/domain';
import { CheckIcon, MinusIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useLocale, useMessages, useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { PriceTag } from '@/components/brand/price-tag';
import { ProductArt } from '@/components/brand/product-art';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StockBadge } from '@/features/catalog/stock-badge';
import { cardHighlights, formatSpecValue } from '@/features/product/spec-format';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { MAX_LIST_QTY } from '@/stores/configurator-store';
import { useIssueText } from './compat-view';
import type { ConfigProduct } from './types';
import type { BuildState } from './use-build';

const sorts = ['popular', 'priceAsc', 'priceDesc'] as const;
type Sort = (typeof sorts)[number];

type Verdict = 'compatible' | 'warning' | 'incompatible';

interface Candidate {
  product: ConfigProduct;
  verdict: Verdict;
  /** Ошибки и предупреждения, которые появятся при выборе (подсказки info не показываем) */
  issues: CompatIssue[];
}

const verdictBadge = { compatible: 'success', warning: 'warning', incompatible: 'danger' } as const;

export function CandidateList({
  slot,
  products,
  state,
  perf,
  chipNames,
  onPlace,
  onQty,
}: {
  slot: PcComponentType;
  products: ConfigProduct[];
  state: BuildState;
  perf: PerfIndex;
  chipNames: Record<string, string>;
  onPlace: (product: ConfigProduct) => void;
  onQty: (product: ConfigProduct, qty: number) => void;
}) {
  const t = useTranslations('configurator');
  const locale = useLocale();
  const specsDict = useMessages().specs;
  const issueText = useIssueText();
  const [query, setQuery] = useState('');
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('popular');
  const deferredQuery = useDeferredValue(query);
  const slotName = t(`slots.${slot}`);

  const candidates = useMemo<Candidate[]>(
    () =>
      products
        .filter((p) => p.componentType === slot)
        .map((product) => {
          const verdict = checkCandidate(state.build, product, perf);
          const issues = verdict.issues.filter((i) => i.severity !== 'info');
          return {
            product,
            issues,
            verdict: !verdict.compatible
              ? 'incompatible'
              : issues.length > 0
                ? 'warning'
                : 'compatible',
          } satisfies Candidate;
        }),
    [products, slot, state.build, perf],
  );

  const tokens = normalizeSearchText(deferredQuery).split(' ').filter(Boolean);
  const matching = candidates.filter((c) => {
    if (inStockOnly && c.product.available <= 0) return false;
    if (tokens.length === 0) return true;
    const haystack = normalizeSearchText(`${c.product.brand} ${c.product.name}`);
    return tokens.every((token) => haystack.includes(token));
  });
  const hiddenCount = onlyCompatible
    ? matching.filter((c) => c.verdict === 'incompatible').length
    : 0;
  const visible = (onlyCompatible ? matching.filter((c) => c.verdict !== 'incompatible') : matching)
    .slice()
    .sort((a, b) => {
      // Несовместимые — всегда в конце списка
      const rank = (c: Candidate) => (c.verdict === 'incompatible' ? 1 : 0);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (sort === 'priceAsc') return a.product.priceUzs - b.product.priceUzs;
      if (sort === 'priceDesc') return b.product.priceUzs - a.product.priceUzs;
      return b.product.popularity - a.product.popularity;
    });

  const selected = new Map(
    state.lines.filter((l) => l.slot === slot).map((l) => [l.product.slug, l.qty]),
  );
  const slotFilled = selected.size > 0;
  const list = isListSlot(slot) && slot !== 'ram';

  return (
    <section
      aria-labelledby="candidates-title"
      className="@container space-y-4"
      data-testid="candidates"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="candidates-title" className="font-display text-xl font-bold">
            {slotName}
          </h2>
          <p className="text-xs text-steel-400" data-testid="candidates-count">
            {t('candidates.count', { count: visible.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="candidate-sort" className="sr-only">
            {t('candidates.sortLabel')}
          </Label>
          <select
            id="candidate-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-md border border-graphite-800 bg-graphite-900 px-2 text-sm text-foreground"
          >
            {sorts.map((s) => (
              <option key={s} value={s}>
                {t(`candidates.sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('candidates.search', { slot: slotName })}
            aria-label={t('candidates.search', { slot: slotName })}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Label className="flex cursor-pointer items-center gap-2 font-normal">
            <Checkbox
              checked={onlyCompatible}
              onCheckedChange={(v) => setOnlyCompatible(v === true)}
              data-testid="only-compatible"
            />
            {t('candidates.onlyCompatible')}
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 font-normal">
            <Checkbox checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(v === true)} />
            {t('candidates.inStockOnly')}
          </Label>
        </div>
      </div>

      {hiddenCount > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-steel-300">
          {t('candidates.hidden', { count: hiddenCount })}
          <button
            type="button"
            onClick={() => setOnlyCompatible(false)}
            className="text-brand-bright hover:underline"
          >
            {t('candidates.showAll')}
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-graphite-700 p-6 text-center text-sm text-steel-300">
          {t('candidates.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map(({ product, verdict, issues }) => {
            const qty = selected.get(product.slug) ?? 0;
            const isSelected = qty > 0;
            const specs = product.specs as Record<string, unknown>;
            const highlights = (cardHighlights[product.componentType] ?? [])
              .map((key) =>
                formatSpecValue(key, specs[key], { locale, dict: specsDict, chipNames }),
              )
              .filter(Boolean);
            return (
              <li
                key={product.slug}
                data-testid="candidate"
                data-slug={product.slug}
                data-verdict={verdict}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border bg-graphite-900 p-3 transition-[border-color,opacity] duration-200 @lg:flex-row @lg:items-center',
                  isSelected
                    ? 'border-brand/60 shadow-glow-sm'
                    : 'border-graphite-800 hover:border-graphite-700',
                  verdict === 'incompatible' && !isSelected && 'opacity-60 hover:opacity-90',
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <ProductArt
                    type={product.componentType}
                    brand={product.brand}
                    size="sm"
                    className="w-16 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="label-caps text-steel-400">{product.brand}</p>
                    <Link
                      href={`/p/${product.slug}`}
                      target="_blank"
                      className="line-clamp-2 text-sm font-medium hover:text-white hover:underline"
                    >
                      {product.name}
                    </Link>
                    {highlights.length > 0 && (
                      <p className="line-clamp-1 font-mono text-xs text-steel-300">
                        {highlights.join(' · ')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge variant={verdictBadge[verdict]}>{t(`candidates.${verdict}`)}</Badge>
                      <StockBadge available={product.available} />
                    </div>
                    {issues.length > 0 && (
                      <p
                        className={cn(
                          'text-xs',
                          verdict === 'incompatible' ? 'text-danger' : 'text-warning',
                        )}
                        data-testid="candidate-reason"
                      >
                        {issueText(issues[0]!)}
                        {issues.length > 1 &&
                          ` (${t('candidates.moreIssues', { count: issues.length - 1 })})`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 @lg:w-48 @lg:flex-col @lg:items-end">
                  <PriceTag
                    amount={product.priceUzs}
                    compareAt={product.compareAtPriceUzs ?? undefined}
                    size="sm"
                  />
                  {list && isSelected ? (
                    <div className="flex items-center gap-1" role="group" aria-label={product.name}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        aria-label={t('actions.decrease')}
                        onClick={() => onQty(product, qty - 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span
                        className="w-8 text-center font-mono text-sm tabular-nums"
                        data-testid="candidate-qty"
                      >
                        {qty}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        aria-label={t('actions.increase')}
                        disabled={qty >= MAX_LIST_QTY}
                        onClick={() => onQty(product, qty + 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        isSelected
                          ? 'outline'
                          : verdict === 'incompatible'
                            ? 'secondary'
                            : 'default'
                      }
                      aria-pressed={isSelected}
                      disabled={isSelected}
                      onClick={() => onPlace(product)}
                      data-testid="candidate-select"
                    >
                      {isSelected && <CheckIcon />}
                      {isSelected
                        ? t('actions.selected')
                        : list
                          ? t('actions.add')
                          : slotFilled
                            ? t('actions.replace')
                            : t('actions.select')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
