'use client';

import type { PcComponentType } from '@redcore/domain';
import { AlertTriangleIcon, CheckIcon, XOctagonIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { componentIcons } from '@/components/brand/product-art';
import { Progress } from '@/components/ui/progress';
import { scrollBehavior } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { stepOrder } from './types';
import type { BuildState } from './use-build';

type StepState = 'error' | 'warning' | 'done' | 'empty';

function stepState(slot: PcComponentType, state: BuildState): StepState {
  const issues = state.check.issues.filter((i) => i.slots.includes(slot));
  if (issues.some((i) => i.severity === 'error')) return 'error';
  const filled = state.lines.some((l) => l.slot === slot);
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return filled ? 'done' : 'empty';
}

const stateIcon = {
  error: <XOctagonIcon className="size-3.5 text-danger" aria-hidden="true" />,
  warning: <AlertTriangleIcon className="size-3.5 text-warning" aria-hidden="true" />,
  done: <CheckIcon className="size-3.5 text-success" aria-hidden="true" />,
  empty: null,
};

/** Шаги сборки: порядок рекомендуемый, но перейти можно к любому. */
export function StepNav({
  state,
  active,
  onSelect,
}: {
  state: BuildState;
  active: PcComponentType;
  onSelect: (slot: PcComponentType) => void;
}) {
  const t = useTranslations('configurator');
  const required = [...state.required];
  const filled = required.filter((slot) => state.lines.some((l) => l.slot === slot)).length;
  const listRef = useRef<HTMLOListElement>(null);

  // На мобильном шаги — горизонтальная лента: держим активный шаг в поле зрения
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const offset = item.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollTo({ left: list.scrollLeft + offset - 16, behavior: scrollBehavior() });
  }, [active]);

  return (
    <nav aria-label={t('steps.label')} className="space-y-3">
      <div className="space-y-1.5 px-1">
        <p className="text-xs text-steel-300" data-testid="steps-progress">
          {t('steps.progress', { filled, total: required.length })}
        </p>
        <Progress value={(filled / required.length) * 100} aria-hidden="true" />
      </div>
      <ol
        ref={listRef}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0"
      >
        {stepOrder.map((slot, index) => {
          const Icon = componentIcons[slot];
          const lines = state.lines.filter((l) => l.slot === slot);
          const s = stepState(slot, state);
          const isActive = slot === active;
          const detail =
            lines.length === 0
              ? state.required.has(slot)
                ? t('steps.required')
                : t('steps.optional')
              : lines.length === 1 && lines[0]!.qty === 1
                ? lines[0]!.product.name
                : t('steps.itemsCount', { count: lines.reduce((n, l) => n + l.qty, 0) });
          return (
            <li key={slot} className="shrink-0 xl:shrink">
              <button
                type="button"
                onClick={() => onSelect(slot)}
                aria-current={isActive ? 'step' : undefined}
                data-testid={`step-${slot}`}
                data-state={s}
                className={cn(
                  'group flex w-44 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color] duration-200 xl:w-full',
                  isActive
                    ? 'border-brand/60 bg-brand/10 shadow-glow-sm'
                    : 'border-graphite-800 bg-graphite-900 hover:border-graphite-700',
                  s === 'error' && !isActive && 'border-danger/40',
                )}
              >
                <span
                  className={cn(
                    'relative grid size-9 shrink-0 place-items-center rounded-md border border-white/5 bg-graphite-850 text-steel-300',
                    isActive && 'text-brand-bright',
                  )}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                  <span className="absolute -top-1.5 -left-1.5 grid size-4 place-items-center rounded-full bg-graphite-800 font-mono text-[10px] text-steel-300">
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t(`slots.${slot}`)}</span>
                    {stateIcon[s]}
                  </span>
                  <span
                    className={cn(
                      'block truncate text-xs',
                      lines.length > 0 ? 'text-steel-300' : 'text-steel-400',
                    )}
                  >
                    {detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
