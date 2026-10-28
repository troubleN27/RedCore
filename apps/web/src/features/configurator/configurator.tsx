'use client';

import { isListSlot, type PcComponentType, type PerfIndex } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePathname, useRouter } from '@/i18n/navigation';
import { scrollBehavior } from '@/lib/motion';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { useStoreHydrated } from '@/stores/store-hydrator';
import { trackBuildEventAction } from '@/server/build-actions';
import { ConfiguratorAssistant } from '@/features/chat/configurator-assistant';
import { FpsPanel } from '@/features/fps/fps-panel';
import type { FpsGameView } from '@/features/fps/types';
import type { FpsModel } from '@redcore/domain';
import { BuildScene } from './build-scene';
import { BuildSummary } from './build-summary';
import { CandidateList } from './candidate-list';
import { BuildStatusLabel } from './compat-view';
import { StepNav } from './step-nav';
import { stepOrder, type BuildItem, type ConfigProduct } from './types';
import { useBuild } from './use-build';

let viewTracked = false;

export function Configurator({
  products,
  perf,
  chipNames,
  shared,
  fps,
}: {
  products: ConfigProduct[];
  perf: PerfIndex;
  chipNames: Record<string, string>;
  /** Сборка из ссылки ?build=… (null — ссылки нет, 'not-found' — сборка не найдена) */
  shared: { publicId: string; items: BuildItem[] } | 'not-found' | null;
  /** Игры калькулятора FPS для панели под итогом */
  fps: { games: FpsGameView[]; model: FpsModel };
}) {
  const t = useTranslations('configurator');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useStoreHydrated();
  const state = useBuild(products, perf);
  const store = useConfiguratorStore();
  const activeSlot = hydrated ? store.activeSlot : 'case';
  const savedId = hydrated ? store.savedId : null;
  const candidatesRef = useRef<HTMLDivElement>(null);

  // Сборка по ссылке заменяет черновик; параметр убираем, чтобы перезагрузка не затирала правки
  useEffect(() => {
    if (!shared) return;
    if (shared === 'not-found') toast.warning(t('loaded.notFound'));
    else {
      useConfiguratorStore.getState().load(shared.items, shared.publicId);
      toast.success(t('loaded.shared'));
    }
    router.replace(pathname, { scroll: false });
  }, [shared, router, pathname, t]);

  useEffect(() => {
    if (viewTracked) return;
    viewTracked = true;
    void trackBuildEventAction({ type: 'configurator_view' });
  }, []);

  function goToSlot(slot: PcComponentType, scroll = true) {
    store.setActiveSlot(slot);
    if (scroll && window.matchMedia('(max-width: 1279px)').matches) {
      candidatesRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }

  function onPlace(product: ConfigProduct) {
    const slot = product.componentType as PcComponentType;
    store.place(slot, product.slug);
    // После выбора одиночной детали — к следующему незаполненному шагу
    if (isListSlot(slot) && slot !== 'ram') return;
    const filled = new Set([...state.lines.map((l) => l.slot), slot]);
    const from = stepOrder.indexOf(slot);
    const next = [...stepOrder.slice(from + 1), ...stepOrder.slice(0, from)].find(
      (s) => !filled.has(s),
    );
    if (next) {
      store.setActiveSlot(next);
      toast(t('steps.next', { slot: t(`slots.${next}`) }), { duration: 1500 });
    }
  }

  return (
    <div
      data-testid="configurator"
      data-hydrated={hydrated}
      className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0 xl:grid-cols-[15rem_minmax(0,1fr)_24rem]"
    >
      <aside className="min-w-0 lg:col-span-2 xl:sticky xl:top-24 xl:col-span-1 xl:self-start">
        <StepNav state={state} active={activeSlot} onSelect={(slot) => goToSlot(slot)} />
      </aside>

      <div className="min-w-0">
        <BuildScene state={state} activeSlot={activeSlot} />
        <div ref={candidatesRef} className="scroll-mt-24">
          <CandidateList
            key={activeSlot}
            slot={activeSlot}
            products={products}
            state={state}
            perf={perf}
            chipNames={chipNames}
            onPlace={onPlace}
            onQty={(product, qty) =>
              store.setQty(product.componentType as PcComponentType, product.slug, qty)
            }
          />
        </div>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
        <BuildSummary
          state={state}
          savedId={savedId}
          onSlotClick={(slot) => goToSlot(slot)}
          onRemove={(slot, slug) => store.remove(slot, slug)}
          onSaved={store.markSaved}
          onClear={store.clear}
        />
        <div className="mt-4">
          <FpsPanel build={state.build} perf={perf} games={fps.games} model={fps.model} />
        </div>
        <div className="mt-4">
          <ConfiguratorAssistant />
        </div>
      </aside>

      {/* Мобильная панель: статус и итог всегда на виду */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-graphite-950/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <BuildStatusLabel status={state.check.status} className="text-xs" />
            <p className="font-display text-base font-bold tabular-nums">
              {formatPrice(state.check.totalUzs, locale)}
            </p>
          </div>
          <a
            href="#build-summary"
            className="shrink-0 rounded-md border border-graphite-700 px-3 py-2 text-sm font-semibold hover:border-brand-bright/60"
          >
            {t('summary.open')}
          </a>
        </div>
      </div>
    </div>
  );
}
