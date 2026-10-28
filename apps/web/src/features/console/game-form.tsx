'use client';

import { presets, resolutions, type Preset } from '@redcore/domain';
import type { GameInput } from '@redcore/services';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { importBenchmarksAction, saveGameAction } from '@/server/console-actions';
import { useConsoleHref } from './console-base';

type Values = GameInput;
type NumberKey = 'hue' | 'cpuAlpha' | 'ramMinGb' | 'ramRecGb' | 'lowRatio' | 'sort';

const NUMBER_FIELDS: NumberKey[] = ['cpuAlpha', 'ramMinGb', 'ramRecGb', 'lowRatio', 'hue', 'sort'];
const SUPPORTS = ['dlss', 'fsr', 'xess', 'frameGen'] as const;
const VENDORS = [
  ['nvidia', 'biasNvidia'],
  ['amd', 'biasAmd'],
  ['intel', 'biasIntel'],
] as const;
const inputClass = 'h-9 w-full rounded-md border border-input bg-graphite-900 px-2 text-sm';
const GAMES_PATH = '/games';
const STEP_ANY = 'any';

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-steel-300">
      <span className="block font-semibold">{label}</span>
      {children}
    </label>
  );
}

const num = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

/** Таблица 3 разрешения × 4 пресета: FPS эталонной карты или видеопамять. */
function Grid({
  title,
  value,
  step,
  onChange,
  testId,
}: {
  title: string;
  value: Values['gpuFps'];
  step: string;
  onChange: (v: Values['gpuFps']) => void;
  testId: string;
}) {
  const t = useTranslations('fps');
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="overflow-x-auto">
        <table className="w-full min-w-md text-xs">
          <thead>
            <tr className="text-steel-400">
              <th />
              {presets.map((p) => (
                <th key={p} className="px-1 py-1 text-left font-medium">
                  {t(`presets.${p}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resolutions.map((r) => (
              <tr key={r}>
                <th className="pr-2 text-left font-medium text-steel-300">
                  {t(`resolutions.${r}`)}
                </th>
                {presets.map((p) => (
                  <td key={p} className="px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      step={step}
                      className={inputClass}
                      value={Number.isNaN(value[r][p]) ? '' : value[r][p]}
                      aria-label={`${title}: ${t(`resolutions.${r}`)}, ${t(`presets.${p}`)}`}
                      data-testid={`${testId}-${r}-${p}`}
                      onChange={(e) =>
                        onChange({ ...value, [r]: { ...value[r], [p]: num(e.target.value) } })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

export function GameForm({ id, initial }: { id: string | null; initial: Values }) {
  const t = useTranslations('console.games');
  const tf = useTranslations('fps');
  const router = useRouter();
  const href = useConsoleHref();
  const [values, setValues] = useState<Values>(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function submit() {
    startTransition(async () => {
      const result = await saveGameAction(id, values);
      if (result.ok) {
        toast.success(t('saved'));
        if (!id && result.id) router.replace(href(`${GAMES_PATH}/${result.id}`));
        else router.refresh();
      } else if (result.error === 'invalid') {
        toast.error(t('invalid', { fields: (result.fields ?? []).join(', ') }));
      } else toast.error(t('failed'));
    });
  }

  return (
    <form
      className="space-y-6"
      data-testid="game-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Labeled label={t('fields.name')}>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            data-testid="game-name"
          />
        </Labeled>
        <Labeled label={t('fields.slug')}>
          <Input
            value={values.slug}
            onChange={(e) => set('slug', e.target.value)}
            data-testid="game-slug"
          />
        </Labeled>
        <Labeled label={t('fields.steamAppId')}>
          <Input
            type="number"
            value={values.steamAppId ?? ''}
            onChange={(e) => set('steamAppId', e.target.value ? Number(e.target.value) : null)}
          />
        </Labeled>
        <Labeled label={t('fields.coverUrl')}>
          <Input
            value={values.coverUrl ?? ''}
            onChange={(e) => set('coverUrl', e.target.value.trim() || null)}
          />
        </Labeled>
        <Labeled label={t('fields.profile')}>
          <select
            className={inputClass}
            value={values.profile}
            onChange={(e) =>
              set('profile', e.target.value === 'competitive' ? 'competitive' : 'aaa')
            }
          >
            <option value="aaa">{t('profiles.aaa')}</option>
            <option value="competitive">{t('profiles.competitive')}</option>
          </select>
        </Labeled>
        {NUMBER_FIELDS.map((key) => (
          <Labeled key={key} label={t(`fields.${key}`)}>
            <Input
              type="number"
              step={STEP_ANY}
              value={Number.isNaN(values[key]) ? '' : values[key]}
              onChange={(e) => set(key, num(e.target.value))}
              data-testid={`game-${key}`}
            />
          </Labeled>
        ))}
        {VENDORS.map(([vendor, label]) => (
          <Labeled key={vendor} label={t(`fields.${label}`)}>
            <Input
              type="number"
              step="0.01"
              value={values.vendorBias[vendor] ?? ''}
              placeholder="1"
              onChange={(e) =>
                set('vendorBias', {
                  ...values.vendorBias,
                  [vendor]: e.target.value ? num(e.target.value) : undefined,
                })
              }
            />
          </Labeled>
        ))}
        <Labeled label={t('fields.good')}>
          <Input
            type="number"
            value={values.thresholds.good}
            onChange={(e) => set('thresholds', { ...values.thresholds, good: num(e.target.value) })}
          />
        </Labeled>
        <Labeled label={t('fields.playable')}>
          <Input
            type="number"
            value={values.thresholds.playable}
            onChange={(e) =>
              set('thresholds', { ...values.thresholds, playable: num(e.target.value) })
            }
          />
        </Labeled>
        <Labeled label={t('fields.fpsCap')}>
          <Input
            type="number"
            value={values.fpsCap ?? ''}
            onChange={(e) => set('fpsCap', e.target.value ? Number(e.target.value) : null)}
          />
        </Labeled>
      </div>

      <fieldset className="flex flex-wrap items-center gap-5 text-sm">
        <legend className="mb-2 text-sm font-semibold">{t('fields.supports')}</legend>
        {SUPPORTS.map((key) => (
          <label key={key} className="inline-flex items-center gap-2">
            <Checkbox
              checked={values.supports[key]}
              onCheckedChange={(checked) =>
                set('supports', { ...values.supports, [key]: checked === true })
              }
            />
            {t(`fields.${key}`)}
          </label>
        ))}
        <label className="inline-flex items-center gap-2">
          <Checkbox
            checked={values.isActive}
            onCheckedChange={(checked) => set('isActive', checked === true)}
            data-testid="game-active"
          />
          {t('fields.isActive')}
        </label>
      </fieldset>

      <Grid
        title={t('grids.gpu')}
        value={values.gpuFps}
        step="1"
        onChange={(v) => set('gpuFps', v)}
        testId="game-gpu"
      />
      <Grid
        title={t('grids.vram')}
        value={values.vramGb}
        step="0.1"
        onChange={(v) => set('vramGb', v)}
        testId="game-vram"
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('grids.cpu')}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {presets.map((p: Preset) => (
            <Labeled key={p} label={tf(`presets.${p}`)}>
              <Input
                type="number"
                value={Number.isNaN(values.cpuFps[p]) ? '' : values.cpuFps[p]}
                onChange={(e) => set('cpuFps', { ...values.cpuFps, [p]: num(e.target.value) })}
                data-testid={`game-cpu-${p}`}
              />
            </Labeled>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} data-testid="game-save">
        {t('save')}
      </Button>
    </form>
  );
}

/** Импорт замеров из CSV: файл читается в браузере, разбор и проверка — на сервере. */
export function BenchmarkImport() {
  const t = useTranslations('console.games.import');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<{
    updated: number;
    errors: { line: number; message: string }[];
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        startTransition(async () => {
          const result = await importBenchmarksAction(await file.text());
          if (!result.ok) {
            toast.error(t('submit'));
            return;
          }
          setReport({ updated: result.updated, errors: result.errors });
          toast.success(t('done', { count: result.updated }));
          router.refresh();
        });
      }}
    >
      <p className="text-xs text-steel-400">{t('hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-steel-300">
          <span className="block font-semibold">{t('file')}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
            data-testid="benchmark-file"
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          disabled={!file || pending}
          data-testid="benchmark-import"
        >
          {t('submit')}
        </Button>
      </div>
      {report && (
        <div className="space-y-1 text-xs" role="status" data-testid="benchmark-report">
          <p className="text-success">{t('done', { count: report.updated })}</p>
          {report.errors.length > 0 && (
            <>
              <p className="text-warning">{t('errors', { count: report.errors.length })}</p>
              <ul className="list-inside list-disc text-steel-300">
                {report.errors.map((err) => (
                  <li key={err.line}>{t('line', err)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
