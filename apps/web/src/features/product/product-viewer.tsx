'use client';

import {
  DEFAULT_RGB,
  finishColors,
  modelExtent,
  modelSpecFor,
  type ComponentType,
  type Finish,
} from '@redcore/domain';
import { BoxIcon, LightbulbIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Quality } from '@/three/materials';
import { builtModel } from '@/three/model-registry';
import { useInitialQuality } from '@/three/quality';

// three.js и сцена грузятся отдельным чанком только когда просмотр попал в экран
const ViewerScene = dynamic(() => import('@/three/viewer-scene'), { ssr: false });

const MOBILE_QUERY = '(max-width: 767px)';
const QUALITIES: Quality[] = ['high', 'medium', 'low'];
const FINISHES: Finish[] = ['black', 'white', 'silver'];

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    /** Для E2E и отладки: статистика рендера (renderer.info) */
    __redcoreViewerStats?: {
      calls: number;
      triangles: number;
      geometries: number;
      textures: number;
    };
  }
}

/**
 * 3D-просмотр на карточке товара. Пока не прокручен в экран — показывается обычная
 * иллюстрация (poster), сцена не загружается вовсе.
 */
export function ProductViewer({
  product,
  customUrl,
  poster,
}: {
  product: { componentType: ComponentType; specs: unknown };
  customUrl?: string | null;
  poster: ReactNode;
}) {
  const t = useTranslations('product.viewer');
  const base = useMemo(() => modelSpecFor(product), [product]);
  const [requested, setRequested] = useState(false);
  const initialQuality = useInitialQuality(requested);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [finish, setFinish] = useState<Finish>(base.finish);
  const [autoRotate, setAutoRotate] = useState(true);
  const [rgbOn, setRgbOn] = useState(true);
  const [rgbColor, setRgbColor] = useState(DEFAULT_RGB);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [onDemand, setOnDemand] = useState(false);
  const [supported, setSupported] = useState(true);
  const [contextKey, setContextKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const spec = useMemo(() => ({ ...base, finish }), [base, finish]);
  const extent = modelExtent(spec);
  const effectiveQuality = quality ?? initialQuality;
  const glb = Boolean(customUrl || builtModel(spec.glbKey));

  useEffect(() => {
    let first = true;
    // На телефоне three.js (~350 КБ gzip) и компиляция шейдеров заметно грузят процессор —
    // сцену открывает сам покупатель кнопкой, на десктопе — сразу при появлении в экране
    let manual = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry?.isIntersecting));
        if (!entry?.isIntersecting) return;
        if (first) {
          first = false;
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAutoRotate(false);
          manual = window.matchMedia(MOBILE_QUERY).matches;
          setOnDemand(manual);
          // Проверка WebGL и определение GPU создают WebGL-контекст — на телефоне только по кнопке
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
  }, []);

  const showScene = supported && mounted && effectiveQuality;

  return (
    <div
      className="space-y-3"
      data-testid="product-viewer"
      data-quality={effectiveQuality ?? ''}
      data-source={glb ? 'glb' : 'procedural'}
    >
      <div
        ref={box}
        className="relative aspect-square overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950 sm:aspect-[4/3]"
      >
        {showScene ? (
          <ViewerScene
            key={contextKey}
            spec={spec}
            extent={extent}
            quality={effectiveQuality}
            autoRotate={autoRotate}
            rgbOn={rgbOn}
            rgbColor={rgbColor}
            customUrl={customUrl}
            active={visible && !document.hidden}
            resetSignal={resetSignal}
            onDegrade={(q) => setQuality(q)}
            onContextLost={() => {
              setLost(true);
              // Пересоздаём Canvas — WebGL-контекст получится заново
              setTimeout(() => {
                setContextKey((k) => k + 1);
                setLost(false);
              }, 600);
            }}
            onStats={(stats) => {
              window.__redcoreViewerStats = stats;
            }}
          />
        ) : (
          <div className="absolute inset-0">{poster}</div>
        )}
        {onDemand && !mounted && supported && (
          <Button
            type="button"
            className="absolute bottom-3 left-1/2 -translate-x-1/2"
            onClick={() => {
              setSupported(webglAvailable());
              setRequested(true);
              setMounted(true);
            }}
            data-testid="viewer-open"
          >
            <BoxIcon />
            {t('open')}
          </Button>
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
        {showScene && !glb && (
          <span className="pointer-events-none absolute top-3 left-3 rounded bg-black/50 px-2 py-1 text-[10px] text-steel-300">
            {t('schematic')}
          </span>
        )}
      </div>

      {supported && (
        <div
          className="flex flex-wrap items-center gap-2 text-xs"
          role="toolbar"
          aria-label={t('title')}
        >
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => setAutoRotate((v) => !v)}
            aria-pressed={autoRotate}
            data-testid="viewer-rotate"
          >
            {autoRotate ? <PauseIcon /> : <PlayIcon />}
            {t('autoRotate')}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => setResetSignal((n) => n + 1)}
          >
            <RotateCcwIcon />
            {t('reset')}
          </Button>
          {spec.rgb && (
            <>
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
              <label className="inline-flex items-center gap-1.5 text-steel-300">
                <input
                  type="color"
                  value={rgbColor}
                  onChange={(e) => setRgbColor(e.target.value)}
                  aria-label={t('rgbColor')}
                  className="size-6 cursor-pointer rounded border border-graphite-700 bg-transparent"
                />
              </label>
            </>
          )}
          <span
            className="ml-auto inline-flex items-center gap-1"
            role="radiogroup"
            aria-label={t('finish')}
          >
            {[...new Set([base.finish, ...FINISHES])].map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={finish === f}
                title={t(`finishes.${f}`)}
                aria-label={t(`finishes.${f}`)}
                onClick={() => setFinish(f)}
                className={cn(
                  'size-5 rounded-full border-2',
                  finish === f ? 'border-brand-bright' : 'border-graphite-700',
                )}
                style={{ background: finishColors[f] }}
              />
            ))}
          </span>
          <label className="inline-flex items-center gap-1.5 text-steel-300">
            {t('quality')}
            <select
              value={effectiveQuality ?? 'medium'}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="h-7 rounded border border-graphite-700 bg-graphite-900 px-1"
              data-testid="viewer-quality"
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {t(`qualities.${q}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="text-xs text-steel-400">{t('hint')}</p>
    </div>
  );
}
