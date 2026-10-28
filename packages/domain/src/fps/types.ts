import type { Resolution } from '../catalog';
import type { GpuVendor } from '../specs/enums';

// Калькулятор FPS (план, §7.2). Эталоны: RTX 5070 (индекс 1.00) и Ryzen 7 9800X3D (1.00).
// Все числа — оценка: модель простая и калибруется по реальным замерам (`pnpm fps:calibrate`).

export const resolutions = ['1080p', '1440p', '2160p'] as const satisfies readonly Resolution[];
export const presets = ['low', 'medium', 'high', 'ultra'] as const;
export type Preset = (typeof presets)[number];

export const upscaleModes = ['off', 'quality', 'balanced', 'performance'] as const;
export type UpscaleMode = (typeof upscaleModes)[number];

export const upscalers = ['dlss', 'fsr', 'xess'] as const;
export type Upscaler = (typeof upscalers)[number];

export const frameGenModes = ['off', '2x', '3x', '4x'] as const;
export type FrameGenMode = (typeof frameGenModes)[number];

export type GameProfile = 'aaa' | 'competitive';

/** Данные игры: FPS эталонной видеокарты без упора в CPU и потолок эталонного CPU. */
export interface GameData {
  slug: string;
  name: string;
  profile: GameProfile;
  /** Чувствительность к CPU, 0.5–1: FPS_CPU = C · I_cpu^α */
  cpuAlpha: number;
  /** Поправка игры к вендору видеокарты (по умолчанию 1) */
  vendorBias: Partial<Record<GpuVendor, number>>;
  ramMinGb: number;
  ramRecGb: number;
  supports: { dlss: boolean; fsr: boolean; xess: boolean; frameGen: boolean };
  /** Пороги цвета: ≥ good — комфортно, ≥ playable — играбельно */
  thresholds: { good: number; playable: number };
  /** 1% low ≈ λ · FPS */
  lowRatio: number;
  /** Движок игры ограничивает FPS (Elden Ring — 60); null — без ограничения */
  fpsCap: number | null;
  /** G[r][p] — FPS эталонной GPU (RTX 5070) без упора в CPU */
  gpuFps: Record<Resolution, Record<Preset, number>>;
  /** Требование к видеопамяти, ГБ */
  vramGb: Record<Resolution, Record<Preset, number>>;
  /** C[p] — потолок эталонного CPU (9800X3D) */
  cpuFps: Record<Preset, number>;
}

/** Видеокарта для расчёта: индексы по разрешениям, видеопамять и поддержка генерации кадров. */
export interface FpsGpu {
  key: string;
  name: string;
  vendor: GpuVendor;
  index1080: number;
  index1440: number;
  index2160: number;
  vramGb: number;
  frameGen: 'none' | 'fg' | 'mfg';
}

export interface FpsCpu {
  key: string;
  name: string;
  gamingIndex: number;
}

export interface FpsRam {
  capacityGb: number;
  channels: 1 | 2;
  type: 'DDR4' | 'DDR5';
  speedMts: number;
}

export interface FpsSettings {
  resolution: Resolution;
  preset: Preset;
  upscale: UpscaleMode;
  /** Желаемый апскейлер; если игра или карта его не поддерживают — берётся доступный */
  upscaler?: Upscaler;
  frameGen: FrameGenMode;
}

/** Глобальные параметры модели (калибруются вместе с коэффициентами игр). */
export interface FpsModel {
  /** Показатель «мягкого минимума» GPU/CPU */
  k: number;
}

export const DEFAULT_FPS_MODEL: FpsModel = { k: 5 };

export type Limiter = 'gpu' | 'cpu' | 'balanced' | 'cap';
export type FpsRating = 'great' | 'playable' | 'bad';

export interface FpsEstimate {
  fps: number;
  low1: number;
  /** Диапазон оценки: ±15%, далеко от эталонов — ±25% */
  range: [number, number];
  fpsGpu: number;
  fpsCpu: number;
  limiter: Limiter;
  rating: FpsRating;
  upscaler: Upscaler | null;
  /** Генерация кадров — отдельная цифра, не смешивается с «настоящими» кадрами */
  frameGen: { mode: Exclude<FrameGenMode, 'off'>; fps: number } | null;
  penalties: { vram: number; ram: number };
  vramReqGb: number;
  extrapolated: boolean;
}
