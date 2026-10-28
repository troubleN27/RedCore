'use client';

import {
  presets,
  resolutions,
  upscaleModes,
  type Preset,
  type Resolution,
  type UpscaleMode,
} from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/navigation';
import { reverseFpsAction } from '@/server/fps-actions';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { Field, Segmented, selectClass } from './controls';
import type { FpsGameView, ReverseActionResult } from './types';

const CONFIGURATOR_PATH = '/configurator';

/** «Хочу N FPS»: подбор на сервере по остаткам, сборку можно открыть в конфигураторе. */
export function ReverseFps({ games }: { games: FpsGameView[] }) {
  const t = useTranslations('fps');
  const tSlots = useTranslations('configurator.slots');
  const locale = useLocale();
  const router = useRouter();
  const [game, setGame] = useState(games[0]?.slug ?? '');
  const [target, setTarget] = useState(60);
  const [resolution, setResolution] = useState<Resolution>('1440p');
  const [preset, setPreset] = useState<Preset>('ultra');
  const [upscale, setUpscale] = useState<UpscaleMode>('off');
  const [result, setResult] = useState<ReverseActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const response = await reverseFpsAction({ game, target, resolution, preset, upscale });
      setResult(response);
      if (!response.ok) toast.error(t('reverse.error'));
    });
  }

  return (
    <div className="space-y-5" data-testid="fps-reverse">
      <p className="text-sm text-steel-300">{t('reverse.hint')}</p>
      <form
        className="grid gap-4 rounded-xl border border-graphite-800 bg-graphite-950 p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t('reverse.game')}>
          <select
            className={selectClass}
            value={game}
            onChange={(e) => setGame(e.target.value)}
            data-testid="reverse-game"
          >
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('reverse.target')}>
          <Input
            type="number"
            min={20}
            max={1000}
            step={10}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
            data-testid="reverse-target"
          />
        </Field>
        <Segmented
          label={t('controls.resolution')}
          value={resolution}
          options={resolutions}
          onChange={setResolution}
          render={(r) => t(`resolutions.${r}`)}
          testId="reverse-res"
        />
        <Segmented
          label={t('controls.preset')}
          value={preset}
          options={presets}
          onChange={setPreset}
          render={(p) => t(`presets.${p}`)}
          testId="reverse-preset"
        />
        <Field label={t('controls.upscale')}>
          <select
            className={selectClass}
            value={upscale}
            onChange={(e) => setUpscale(e.target.value as UpscaleMode)}
          >
            {upscaleModes.map((u) => (
              <option key={u} value={u}>
                {t(`upscaleModes.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end sm:col-span-1 lg:col-span-3">
          <Button type="submit" disabled={pending || target < 20} data-testid="reverse-submit">
            {pending ? t('reverse.loading') : t('reverse.submit')}
          </Button>
        </div>
      </form>

      {result?.ok && !result.achievable && (
        <div
          className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
          role="status"
          data-testid="reverse-unachievable"
        >
          <p className="font-semibold">{t('reverse.unachievable')}</p>
          <p className="text-steel-300">
            {result.suggestion?.preset
              ? t('reverse.suggestPreset', {
                  preset: t(`presets.${result.suggestion.preset as Preset}`),
                })
              : result.suggestion?.upscale
                ? t('reverse.suggestUpscale', {
                    mode: t(`upscaleModes.${result.suggestion.upscale as UpscaleMode}`),
                  })
                : t('reverse.tooHigh')}
          </p>
        </div>
      )}

      {result?.ok && result.variants.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="reverse-variants">
          {result.variants.map((v) => (
            <article
              key={v.tier}
              className="flex flex-col gap-3 rounded-xl border border-graphite-800 bg-graphite-950 p-4"
              data-testid="reverse-variant"
              data-tier={v.tier}
              data-fps={v.fps}
            >
              <header className="space-y-1">
                <p className="text-xs font-bold tracking-wider text-brand-bright uppercase">
                  {t(`reverse.tiers.${v.tier}`)}
                </p>
                <p className="font-display text-lg font-bold tabular-nums">
                  {t('reverse.forecast', { fps: v.fps, min: v.range[0], max: v.range[1] })}
                </p>
              </header>
              <ul className="flex-1 space-y-1 text-xs">
                {v.lines.map((line) => (
                  <li key={`${line.slot}:${line.name}`} className="flex gap-2">
                    <span className="w-24 shrink-0 text-steel-400">
                      {tSlots(line.slot as 'cpu')}
                    </span>
                    <span className="min-w-0 flex-1">
                      {line.name}
                      {line.qty > 1 && ` ×${line.qty}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex items-baseline justify-between border-t border-graphite-800 pt-3 text-sm">
                <span className="text-steel-400">{t('reverse.total')}</span>
                <span className="font-display font-bold tabular-nums">
                  {formatPrice(v.totalUzs, locale)}
                </span>
              </p>
              <Button
                type="button"
                variant="secondary"
                data-testid="reverse-open"
                onClick={() => {
                  useConfiguratorStore.getState().load(v.items, null);
                  toast.success(t('reverse.opened'));
                  router.push(CONFIGURATOR_PATH);
                }}
              >
                {t('reverse.open')}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
