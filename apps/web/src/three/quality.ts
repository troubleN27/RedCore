'use client';

import { getGPUTier } from 'detect-gpu';
import { useEffect, useState } from 'react';
import type { Quality } from './materials';

/** Настройки рендера по уровню качества (см. план, §11). */
export const qualitySettings: Record<
  Quality,
  {
    dpr: [number, number];
    shadows: boolean;
    bloom: boolean;
    glassTransmission: boolean;
    demandWhenIdle: boolean;
  }
> = {
  high: { dpr: [1, 2], shadows: true, bloom: true, glassTransmission: true, demandWhenIdle: false },
  medium: {
    dpr: [1, 1.5],
    shadows: true,
    bloom: true,
    glassTransmission: false,
    demandWhenIdle: false,
  },
  low: {
    dpr: [1, 1],
    shadows: false,
    bloom: false,
    glassTransmission: false,
    demandWhenIdle: true,
  },
};

const order: Quality[] = ['low', 'medium', 'high'];

export function lowerQuality(q: Quality): Quality {
  return order[Math.max(0, order.indexOf(q) - 1)]!;
}

/**
 * Начальный уровень — по GPU (detect-gpu, без сети: бенчмарки только для известных чипов;
 * неизвестный — medium). Телефоны не выше medium. Дальше PerformanceMonitor понижает на лету.
 */
export function useInitialQuality(enabled = true): Quality | null {
  const [quality, setQuality] = useState<Quality | null>(null);
  useEffect(() => {
    // Определение GPU создаёт WebGL-контекст — дорого на слабых телефонах: только по запросу
    if (!enabled) return;
    let active = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    getGPUTier({ failIfMajorPerformanceCaveat: false, benchmarksURL: '/detect-gpu' })
      .then((gpu) => {
        if (!active) return;
        // Программный WebGL (SwiftShader, llvmpipe) рисует на CPU: даже medium вешает страницу
        const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu.gpu ?? '');
        const tierQuality: Quality =
          software || gpu.tier <= 1 ? 'low' : gpu.tier >= 3 ? 'high' : 'medium';
        const capped = gpu.isMobile && tierQuality === 'high' ? 'medium' : tierQuality;
        setQuality(reduced && capped === 'high' ? 'medium' : capped);
      })
      .catch(() => active && setQuality('medium'));
    return () => {
      active = false;
    };
  }, [enabled]);
  return quality;
}
