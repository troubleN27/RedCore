'use client';

import {
  estimateFps,
  frameGenModes,
  presets,
  resolutions,
  upscaleModes,
  upscalers,
  type FpsRam,
  type FpsSettings,
  type Preset,
  type Resolution,
} from '@redcore/domain';
import { InfoIcon, WandSparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { Field, Segmented, selectClass } from './controls';
import { GameFpsRow } from './game-row';
import { ReverseFps } from './reverse-fps';
import type { FpsPageData, PartLookup } from './types';

const RAM_PRESETS: FpsRam[] = [
  { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 },
  { capacityGb: 16, channels: 2, type: 'DDR5', speedMts: 5600 },
  { capacityGb: 64, channels: 2, type: 'DDR5', speedMts: 6000 },
  { capacityGb: 16, channels: 1, type: 'DDR5', speedMts: 5600 },
  { capacityGb: 32, channels: 2, type: 'DDR4', speedMts: 3600 },
  { capacityGb: 16, channels: 2, type: 'DDR4', speedMts: 3200 },
  { capacityGb: 8, channels: 1, type: 'DDR4', speedMts: 3200 },
];
const ramKey = (r: FpsRam) => `${r.capacityGb}-${r.channels}-${r.type}-${r.speedMts}`;
const DEFAULT_GPU = 'rtx-5070';
const DEFAULT_CPU = 'ryzen-7-7800x3d';
const SORT_FPS = 'fps';
const SORT_NAME = 'name';
const TAB_FORWARD = 'forward';

/** Параметры сборки из черновика конфигуратора (по slug → ключи индексов). */
function fromDraft(parts: PartLookup) {
  const items = useConfiguratorStore.getState().items;
  const gpu = items.find((i) => i.slot === 'gpu');
  const cpu = items.find((i) => i.slot === 'cpu');
  const gpuPart = gpu ? parts.gpu[gpu.slug] : undefined;
  const cpuKey = cpu ? parts.cpu[cpu.slug] : undefined;
  if (!gpuPart || !cpuKey) return null;
  let ram: FpsRam | null = null;
  const ramItems = items.filter((i) => i.slot === 'ram');
  if (ramItems.length > 0) {
    let capacityGb = 0;
    let modules = 0;
    let speedMts = Infinity;
    let type: FpsRam['type'] = 'DDR5';
    for (const item of ramItems) {
      const r = parts.ram[item.slug];
      if (!r) continue;
      capacityGb += r.capacityGb * item.qty;
      modules += r.modules * item.qty;
      speedMts = Math.min(speedMts, r.speedMts);
      type = r.type;
    }
    if (capacityGb > 0) ram = { capacityGb, channels: modules >= 2 ? 2 : 1, type, speedMts };
  }
  return { gpuKey: gpuPart.key, cpuKey, ram };
}

export function FpsCalculator({ data }: { data: FpsPageData }) {
  const t = useTranslations('fps');
  const [gpuKey, setGpuKey] = useState(
    data.gpus.some((g) => g.key === DEFAULT_GPU) ? DEFAULT_GPU : (data.gpus[0]?.key ?? ''),
  );
  const [cpuKey, setCpuKey] = useState(
    data.cpus.some((c) => c.key === DEFAULT_CPU) ? DEFAULT_CPU : (data.cpus[0]?.key ?? ''),
  );
  const [ram, setRam] = useState<FpsRam>(RAM_PRESETS[0]!);
  const [settings, setSettings] = useState<FpsSettings>({
    resolution: '1440p',
    preset: 'high',
    upscale: 'off',
    upscaler: 'dlss',
    frameGen: 'off',
  });
  const [sort, setSort] = useState<typeof SORT_FPS | typeof SORT_NAME>(SORT_FPS);
  const set = <K extends keyof FpsSettings>(key: K, value: FpsSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const ramOptions = RAM_PRESETS.some((r) => ramKey(r) === ramKey(ram))
    ? RAM_PRESETS
    : [ram, ...RAM_PRESETS];
  const gpu = data.gpus.find((g) => g.key === gpuKey);
  const cpu = data.cpus.find((c) => c.key === cpuKey);

  const rows = useMemo(() => {
    if (!gpu || !cpu) return [];
    const list = data.games.map((game) => ({
      game,
      estimate: estimateFps(game, gpu, cpu, ram, settings, data.model),
    }));
    return sort === SORT_NAME
      ? list.sort((a, b) => a.game.name.localeCompare(b.game.name))
      : list.sort((a, b) => b.estimate.fps - a.estimate.fps);
  }, [data, gpu, cpu, ram, settings, sort]);

  function applyDraft() {
    const draft = fromDraft(data.parts);
    if (!draft || !data.gpus.some((g) => g.key === draft.gpuKey)) {
      toast.warning(t('controls.fromBuildEmpty'));
      return;
    }
    setGpuKey(draft.gpuKey);
    setCpuKey(draft.cpuKey);
    if (draft.ram) setRam(draft.ram);
    toast.success(t('controls.fromBuildDone'));
  }

  const resolutionLabel = (r: Resolution) => t(`resolutions.${r}`);
  const presetLabel = (p: Preset) => t(`presets.${p}`);

  return (
    <div className="space-y-6" data-testid="fps-calculator">
      <div className="flex flex-wrap items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-brand-bright/50 bg-brand/15 px-3 py-1 text-xs font-bold tracking-wider text-brand-bright uppercase"
              tabIndex={0}
              data-testid="fps-estimate-badge"
            >
              <InfoIcon className="size-3.5" />
              {t('estimate')}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-xs leading-relaxed">
            {t('method')}
          </TooltipContent>
        </Tooltip>
        <details className="text-xs text-steel-400">
          <summary className="cursor-pointer hover:text-white">{t('methodTitle')}</summary>
          <p className="mt-2 max-w-3xl leading-relaxed">{t('method')}</p>
        </details>
      </div>

      <Tabs defaultValue={TAB_FORWARD}>
        <TabsList>
          <TabsTrigger value="forward" data-testid="fps-tab-forward">
            {t('tabs.forward')}
          </TabsTrigger>
          <TabsTrigger value="reverse" data-testid="fps-tab-reverse">
            {t('tabs.reverse')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forward" className="mt-4 space-y-5">
          <div className="grid gap-4 rounded-xl border border-graphite-800 bg-graphite-950 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('controls.gpu')}>
              <select
                className={selectClass}
                value={gpuKey}
                onChange={(e) => setGpuKey(e.target.value)}
                data-testid="fps-gpu"
              >
                {data.gpus.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('controls.cpu')}>
              <select
                className={selectClass}
                value={cpuKey}
                onChange={(e) => setCpuKey(e.target.value)}
                data-testid="fps-cpu"
              >
                {data.cpus.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('controls.ram')}>
              <select
                className={selectClass}
                value={ramKey(ram)}
                onChange={(e) =>
                  setRam(ramOptions.find((r) => ramKey(r) === e.target.value) ?? ram)
                }
                data-testid="fps-ram"
              >
                {ramOptions.map((r) => (
                  <option key={ramKey(r)} value={ramKey(r)}>
                    {t(r.channels === 2 ? 'ram.dual' : 'ram.single', {
                      gb: r.capacityGb,
                      type: `${r.type}-${r.speedMts}`,
                    })}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={applyDraft}
                data-testid="fps-from-build"
              >
                <WandSparklesIcon />
                {t('controls.fromBuild')}
              </Button>
            </div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:col-span-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,2fr)]">
              <Segmented
                label={t('controls.resolution')}
                value={settings.resolution}
                options={resolutions}
                onChange={(v) => set('resolution', v)}
                render={resolutionLabel}
                testId="fps-res"
              />
              <Segmented
                label={t('controls.preset')}
                value={settings.preset}
                options={presets}
                onChange={(v) => set('preset', v)}
                render={presetLabel}
                testId="fps-preset"
              />
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
                <Field label={t('controls.upscale')}>
                  <select
                    className={selectClass}
                    value={settings.upscale}
                    onChange={(e) => set('upscale', e.target.value as FpsSettings['upscale'])}
                    data-testid="fps-upscale"
                  >
                    {upscaleModes.map((u) => (
                      <option key={u} value={u}>
                        {t(`upscaleModes.${u}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('controls.upscaler')}>
                  <select
                    className={selectClass}
                    value={settings.upscaler}
                    disabled={settings.upscale === 'off'}
                    onChange={(e) => set('upscaler', e.target.value as FpsSettings['upscaler'])}
                  >
                    {upscalers.map((u) => (
                      <option key={u} value={u}>
                        {t(`upscalers.${u}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
              <Field label={t('controls.frameGen')}>
                <select
                  className={selectClass}
                  value={settings.frameGen}
                  onChange={(e) => set('frameGen', e.target.value as FpsSettings['frameGen'])}
                  data-testid="fps-framegen"
                >
                  {frameGenModes.map((f) => (
                    <option key={f} value={f}>
                      {t(`frameGenModes.${f}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('controls.sort')}>
                <select
                  className={selectClass}
                  value={sort}
                  onChange={(e) => setSort(e.target.value === SORT_NAME ? SORT_NAME : SORT_FPS)}
                >
                  <option value={SORT_FPS}>{t('controls.sortFps')}</option>
                  <option value={SORT_NAME}>{t('controls.sortName')}</option>
                </select>
              </Field>
            </div>
          </div>

          <ul
            className="divide-y divide-graphite-800 rounded-xl border border-graphite-800 bg-graphite-950 px-4"
            data-testid="fps-results"
            aria-live="polite"
          >
            {rows.map(({ game, estimate }) => (
              <GameFpsRow key={game.slug} game={game} estimate={estimate} />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="reverse" className="mt-4">
          <ReverseFps games={data.games} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
