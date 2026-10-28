'use client';

import { DEFAULT_RGB, fitsInCase, layoutBuild, type PcComponentType } from '@redcore/domain';
import { BoxIcon, CameraIcon, EyeOffIcon, LightbulbIcon, ScanEyeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/three/configurator/assembly-parts';
import type { Quality } from '@/three/materials';
import { useInitialQuality } from '@/three/quality';
import type { BuildState } from './use-build';

// three.js и сцена сборки — отдельный чанк, грузится, только когда блок попал в экран
const AssemblyScene = dynamic(() => import('@/three/configurator/assembly-scene'), {
  ssr: false,
  loading: () => <Preloader />,
});

const MODES: ViewMode[] = ['normal', 'panel', 'exploded', 'focus'];
const QUALITIES: Quality[] = ['high', 'medium', 'low'];
const OVERVIEW = 'overview' as const;
const MOBILE_QUERY = '(max-width: 767px)';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function Preloader() {
  const t = useTranslations('configurator.scene');
  return (
    <div className="absolute inset-0 grid place-items-center" role="status">
      <div className="w-40 space-y-2 text-center text-xs text-steel-400">
        <div className="h-1 overflow-hidden rounded-full bg-graphite-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand shadow-[0_0_12px_rgb(255_40_0/0.45)]" />
        </div>
        {t('loading')}
      </div>
    </div>
  );
}

/**
 * 3D-сборка в конфигураторе: сцена повторяет store — выбор детали сразу ставит её в корпус
 * с анимацией, камера перелетает к активному шагу.
 */
export function BuildScene({
  state,
  activeSlot,
}: {
  state: BuildState;
  activeSlot: PcComponentType;
}) {
  const t = useTranslations('configurator.scene');
  const layout = useMemo(() => layoutBuild(state.build), [state.build]);
  const [requested, setRequested] = useState(false);
  const initialQuality = useInitialQuality(requested);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [mode, setMode] = useState<ViewMode>('normal');
  const [rgbOn, setRgbOn] = useState(true);
  const [rgbColor, setRgbColor] = useState(DEFAULT_RGB);
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [onDemand, setOnDemand] = useState(false);
  const [supported, setSupported] = useState(true);
  const [contextKey, setContextKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cameraSlot, setCameraSlot] = useState<PcComponentType | typeof OVERVIEW>(activeSlot);
  const [prevSlot, setPrevSlot] = useState(activeSlot);
  const snapshot = useRef<(() => string) | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Новый шаг — камера к его слоту; кнопка «Обзор» переключает на весь корпус
  if (prevSlot !== activeSlot) {
    setPrevSlot(activeSlot);
    setCameraSlot(activeSlot);
  }

  const effectiveQuality = quality ?? initialQuality;
  const labels = useMemo(
    () => Object.fromEntries(state.lines.map((l) => [l.product.id, l.product.name])),
    [state.lines],
  );
  const conflicts = layout.placements.some((p) => !fitsInCase(layout, p, 0.004));

  useEffect(() => {
    let first = true;
    // На телефоне сцену включает покупатель (кнопка), на десктопе — сразу при появлении в экране
    let manual = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry?.isIntersecting));
        if (!entry?.isIntersecting) return;
        if (first) {
          first = false;
          setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
          manual = window.matchMedia(MOBILE_QUERY).matches;
          setOnDemand(manual);
          // WebGL-проверка и определение GPU на телефоне — только по кнопке «Показать 3D»
          if (!manual) {
            setSupported(webglAvailable());
            setRequested(true);
          }
        }
        if (!manual) setMounted(true);
      },
      { rootMargin: '200px' },
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [open]);

  function takeSnapshot() {
    const url = snapshot.current?.();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'redcore-build.png';
    link.click();
    toast.success(t('snapshotDone'));
  }

  const showScene = open && supported && mounted && effectiveQuality;

  return (
    <section
      className="mb-6 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950"
      aria-label={t('title')}
      data-testid="build-scene"
      data-mode={mode}
      data-quality={effectiveQuality ?? ''}
    >
      <div className="flex items-center justify-between gap-3 border-b border-graphite-800 px-4 py-2.5">
        <h2 className="font-display text-sm font-bold tracking-wide">{t('title')}</h2>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          data-testid="scene-toggle"
        >
          {open ? <EyeOffIcon /> : <BoxIcon />}
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && (
        <>
          <div ref={box} className="relative h-72 sm:h-96 xl:h-[28rem]">
            {showScene ? (
              <AssemblyScene
                key={contextKey}
                layout={layout}
                activeSlot={activeSlot}
                cameraSlot={cameraSlot}
                mode={mode}
                quality={effectiveQuality}
                rgbOn={rgbOn}
                rgbColor={rgbColor}
                labels={labels}
                active={visible}
                resetSignal={resetSignal}
                reducedMotion={reducedMotion}
                snapshot={snapshot}
                onDegrade={(q) => setQuality(q)}
                onContextLost={() => {
                  setLost(true);
                  setTimeout(() => {
                    setContextKey((k) => k + 1);
                    setLost(false);
                  }, 600);
                }}
              />
            ) : (
              supported &&
              (onDemand && !mounted ? (
                <div className="absolute inset-0 grid place-items-center">
                  <Button
                    type="button"
                    onClick={() => {
                      setSupported(webglAvailable());
                      setRequested(true);
                      setMounted(true);
                    }}
                    data-testid="scene-open"
                  >
                    <BoxIcon />
                    {t('show')}
                  </Button>
                </div>
              ) : (
                <Preloader />
              ))
            )}
            {!supported && (
              <p className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-3 py-2 text-xs text-steel-300">
                {t('unsupported')}
              </p>
            )}
            {lost && (
              <p
                className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-3 py-2 text-xs text-warning"
                role="status"
              >
                {t('lost')}
              </p>
            )}
            {showScene && (
              <div className="pointer-events-none absolute top-3 left-3 space-y-1 text-[10px] text-steel-300">
                <p className="w-fit rounded bg-black/50 px-2 py-1">{t('schematic')}</p>
                {layout.defaultCase && (
                  <p className="w-fit rounded bg-black/50 px-2 py-1">{t('defaultCase')}</p>
                )}
                {conflicts && (
                  <p
                    className="w-fit rounded bg-black/60 px-2 py-1 text-danger"
                    data-testid="scene-conflict"
                  >
                    {t('outOfCase')}
                  </p>
                )}
              </div>
            )}
          </div>

          {supported && (
            <div
              className="flex flex-wrap items-center gap-2 border-t border-graphite-800 px-3 py-2.5 text-xs"
              role="toolbar"
              aria-label={t('title')}
            >
              <span
                className="inline-flex flex-wrap gap-1"
                role="radiogroup"
                aria-label={t('modes.label')}
              >
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    data-testid={`scene-mode-${m}`}
                    className={cn(
                      'rounded-md border px-2.5 py-1 font-semibold transition-colors',
                      mode === m
                        ? 'border-brand-bright/70 bg-brand/15 text-white'
                        : 'hover:border-graphite-600 border-graphite-700 text-steel-300',
                    )}
                  >
                    {t(`modes.${m}`)}
                  </button>
                ))}
              </span>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => {
                  setCameraSlot(OVERVIEW);
                  setResetSignal((n) => n + 1);
                }}
              >
                <ScanEyeIcon />
                {t('overview')}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => setRgbOn((v) => !v)}
                aria-pressed={rgbOn}
              >
                <LightbulbIcon className={cn(rgbOn && 'text-brand-bright')} />
                {t('rgb')}
              </Button>
              <input
                type="color"
                value={rgbColor}
                onChange={(e) => setRgbColor(e.target.value)}
                aria-label={t('rgbColor')}
                className="size-6 cursor-pointer rounded border border-graphite-700 bg-transparent"
              />
              <label className="ml-auto inline-flex items-center gap-1.5 text-steel-300">
                {t('quality')}
                <select
                  value={effectiveQuality ?? 'medium'}
                  onChange={(e) => setQuality(e.target.value as Quality)}
                  className="h-7 rounded border border-graphite-700 bg-graphite-900 px-1"
                  data-testid="scene-quality"
                >
                  {QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {t(`qualities.${q}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={takeSnapshot}
                disabled={!showScene}
                data-testid="scene-snapshot"
              >
                <CameraIcon />
                {t('snapshot')}
              </Button>
            </div>
          )}
          <p className="px-4 pb-3 text-xs text-steel-400">{t('hint')}</p>
        </>
      )}
    </section>
  );
}
