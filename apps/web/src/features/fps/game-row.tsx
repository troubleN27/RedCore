'use client';

import type { FpsEstimate } from '@redcore/domain';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { FpsGameView } from './types';

const ratingColor = {
  great: { bar: 'bg-success', text: 'text-success' },
  playable: { bar: 'bg-warning', text: 'text-warning' },
  bad: { bar: 'bg-danger', text: 'text-danger' },
} as const;

/** Обложка со Steam; нет обложки или не загрузилась — градиент в цвете игры. */
export function GameCover({ game, className }: { game: FpsGameView; className?: string }) {
  const t = useTranslations('fps');
  const [failed, setFailed] = useState(false);
  const fallback = (
    <div
      className={cn(
        'grid place-items-center rounded font-display text-[10px] font-bold',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${game.hue} 70% 32%), hsl(${game.hue} 60% 12%))`,
      }}
      aria-hidden
    >
      {game.name.slice(0, 2).toUpperCase()}
    </div>
  );
  if (!game.coverUrl || failed) return fallback;
  return (
    // Обложки Steam — внешние картинки фиксированного размера: оптимизатор Next не нужен
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={game.coverUrl}
      alt={t('cover', { name: game.name })}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('rounded object-cover', className)}
    />
  );
}

/**
 * Строка игры: полоса FPS с диапазоном оценки и порогами «играбельно/комфортно».
 * Шкала своя у каждой игры — пороги киберспорта и AAA разные.
 */
export function GameFpsRow({
  game,
  estimate,
  compact = false,
}: {
  game: FpsGameView;
  estimate: FpsEstimate;
  compact?: boolean;
}) {
  const t = useTranslations('fps');
  const scale = Math.max(game.thresholds.good * 1.5, estimate.range[1] * 1.05);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const color = ratingColor[estimate.rating];
  const notes: string[] = [];
  if (!compact) {
    notes.push(
      estimate.limiter === 'cap'
        ? t('result.limiter.cap', { cap: game.fpsCap ?? estimate.fps })
        : t(`result.limiter.${estimate.limiter}`),
    );
    if (estimate.penalties.vram < 1) notes.push(t('result.vram', { need: estimate.vramReqGb }));
    if (estimate.penalties.ram < 1) notes.push(t('result.ram'));
    if (estimate.upscaler)
      notes.push(t('result.upscaler', { name: t(`upscalers.${estimate.upscaler}`) }));
    if (estimate.extrapolated) notes.push(t('result.extrapolated'));
  }

  return (
    <li
      className="flex items-center gap-3 py-2.5"
      data-testid="fps-row"
      data-game={game.slug}
      data-fps={estimate.fps}
      data-rating={estimate.rating}
      data-limiter={estimate.limiter}
    >
      <GameCover game={game} className={compact ? 'h-8 w-16 shrink-0' : 'h-11 w-24 shrink-0'} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            {game.name}
            {game.profile === 'competitive' && !compact && (
              <span className="ml-2 rounded bg-graphite-800 px-1.5 py-0.5 text-[10px] font-medium text-steel-300 uppercase">
                {t('result.competitive')}
              </span>
            )}
          </p>
          <p className={cn('shrink-0 font-display text-sm font-bold tabular-nums', color.text)}>
            {t('result.fps', { fps: estimate.fps })}
          </p>
        </div>
        <div
          className="relative h-2 rounded-full bg-graphite-800"
          role="img"
          aria-label={`${t(`result.rating.${estimate.rating}`)}. ${t('result.thresholds', game.thresholds)}`}
        >
          {/* Диапазон оценки — полупрозрачная подложка, сама оценка — сплошная полоса */}
          <div
            className={cn('absolute inset-y-0 rounded-full opacity-30', color.bar)}
            style={{
              left: pct(estimate.range[0]),
              width: `calc(${pct(estimate.range[1])} - ${pct(estimate.range[0])})`,
            }}
          />
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full', color.bar)}
            style={{ width: pct(estimate.fps) }}
          />
          {[game.thresholds.playable, game.thresholds.good].map((v) => (
            <span
              key={v}
              className="absolute -inset-y-0.5 w-px bg-white/50"
              style={{ left: pct(v) }}
              aria-hidden
            />
          ))}
        </div>
        {!compact && (
          <p className="flex flex-wrap gap-x-3 text-[11px] text-steel-400">
            <span className="tabular-nums">
              {t('result.range', { min: estimate.range[0], max: estimate.range[1] })}
            </span>
            <span className="tabular-nums">{t('result.low', { fps: estimate.low1 })}</span>
            <span className={color.text}>{t(`result.rating.${estimate.rating}`)}</span>
            {estimate.frameGen && (
              <span className="text-brand-bright tabular-nums">
                {t('result.frameGen', {
                  mode: t(`frameGenModes.${estimate.frameGen.mode}`),
                  fps: estimate.frameGen.fps,
                })}
              </span>
            )}
            {notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}
