'use client';

import {
  buildFpsParts,
  estimateFps,
  presets,
  resolutions,
  type Build,
  type FpsModel,
  type PerfIndex,
  type Preset,
  type Resolution,
} from '@redcore/domain';
import { GaugeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Segmented } from './controls';
import { GameFpsRow } from './game-row';
import type { FpsGameView } from './types';

/** FPS текущей сборки в конфигураторе: пересчитывается на каждое изменение деталей. */
export function FpsPanel({
  build,
  perf,
  games,
  model,
}: {
  build: Build;
  perf: PerfIndex;
  games: FpsGameView[];
  model: FpsModel;
}) {
  const t = useTranslations('fps');
  const [resolution, setResolution] = useState<Resolution>('1440p');
  const [preset, setPreset] = useState<Preset>('high');
  const parts = useMemo(() => buildFpsParts(build, perf), [build, perf]);
  const rows = useMemo(() => {
    if (!parts) return [];
    return games
      .map((game) => ({
        game,
        estimate: estimateFps(
          game,
          parts.gpu,
          parts.cpu,
          parts.ram,
          { resolution, preset, upscale: 'off', frameGen: 'off' },
          model,
        ),
      }))
      .sort((a, b) => b.estimate.fps - a.estimate.fps);
  }, [parts, games, model, resolution, preset]);

  return (
    <section
      className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-950 p-4"
      data-testid="fps-panel"
      aria-label={t('panel.title')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold">
          <GaugeIcon className="size-4 text-brand-bright" />
          {t('panel.title')}
        </h2>
        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-bright uppercase">
          {t('estimate')}
        </span>
      </div>
      {!parts ? (
        <p className="text-xs text-steel-400">{t('panel.needParts')}</p>
      ) : (
        <>
          <div className="grid gap-2">
            <Segmented
              label={t('controls.resolution')}
              value={resolution}
              options={resolutions}
              onChange={setResolution}
              render={(r) => t(`resolutions.${r}`)}
              testId="panel-res"
            />
            <Segmented
              label={t('controls.preset')}
              value={preset}
              options={presets}
              onChange={setPreset}
              render={(p) => t(`presets.${p}`)}
              testId="panel-preset"
            />
          </div>
          <ul className="max-h-80 divide-y divide-graphite-800 overflow-y-auto pr-1">
            {rows.map(({ game, estimate }) => (
              <GameFpsRow key={game.slug} game={game} estimate={estimate} compact />
            ))}
          </ul>
        </>
      )}
      <Link href="/fps" className="block text-xs font-semibold text-brand-bright hover:underline">
        {t('panel.more')}
      </Link>
    </section>
  );
}
