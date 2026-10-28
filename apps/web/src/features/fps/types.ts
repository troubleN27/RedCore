import type { FpsCpu, FpsGpu, FpsModel, GameData, ReverseTier } from '@redcore/domain';
import type { BuildItem } from '@/features/configurator/types';

/** Игра в браузере: данные расчёта плюс обложка. */
export type FpsGameView = GameData & {
  steamAppId: number | null;
  coverUrl: string | null;
  hue: number;
};

export interface PartLookup {
  gpu: Record<string, { key: string; vramGb: number }>;
  cpu: Record<string, string>;
  ram: Record<
    string,
    { capacityGb: number; modules: number; type: 'DDR4' | 'DDR5'; speedMts: number }
  >;
}

export interface FpsPageData {
  games: FpsGameView[];
  gpus: FpsGpu[];
  cpus: FpsCpu[];
  model: FpsModel;
  parts: PartLookup;
}

export interface ReverseVariantView {
  tier: ReverseTier;
  totalUzs: number;
  fps: number;
  range: [number, number];
  items: BuildItem[];
  lines: { slot: string; name: string; qty: number }[];
}

export type ReverseActionResult =
  | {
      ok: true;
      achievable: boolean;
      variants: ReverseVariantView[];
      suggestion: { preset?: string; upscale?: string } | null;
    }
  | { ok: false };
