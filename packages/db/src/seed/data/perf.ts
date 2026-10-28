import type { CpuPerf, GpuPerf } from '@redcore/domain';

// Относительная производительность, эталоны: RTX 5070 = 1.00 (по разрешениям), Ryzen 7 9800X3D = 1.00.
// Значения — сводка публичных обзоров (TechPowerUp, PCGH, Tom's Hardware), округлены; это
// стартовая калибровка, которую админ уточняет на этапе 8 по реальным замерам.

type GpuSeed = GpuPerf & { rtIndex: number; upscalers: string[]; vramGb: number };

const nvidia = (
  key: string,
  name: string,
  i1080: number,
  i1440: number,
  i2160: number,
  rt: number,
  frameGen: GpuPerf['frameGen'],
): Omit<GpuSeed, 'vramGb'> => ({
  key,
  name,
  vendor: 'nvidia',
  index1080: i1080,
  index1440: i1440,
  index2160: i2160,
  rtIndex: rt,
  frameGen,
  upscalers: ['dlss', 'fsr', 'xess'],
});

const amd = (
  key: string,
  name: string,
  i1080: number,
  i1440: number,
  i2160: number,
  rt: number,
  fsr4: boolean,
): Omit<GpuSeed, 'vramGb'> => ({
  key,
  name,
  vendor: 'amd',
  index1080: i1080,
  index1440: i1440,
  index2160: i2160,
  rtIndex: rt,
  frameGen: 'fg',
  upscalers: fsr4 ? ['fsr4', 'fsr', 'xess'] : ['fsr', 'xess'],
});

const intel = (
  key: string,
  name: string,
  i1080: number,
  i1440: number,
  i2160: number,
  rt: number,
): Omit<GpuSeed, 'vramGb'> => ({
  key,
  name,
  vendor: 'intel',
  index1080: i1080,
  index1440: i1440,
  index2160: i2160,
  rtIndex: rt,
  frameGen: 'fg',
  upscalers: ['xess', 'fsr'],
});

/** Видеопамять типовой карты на чипе, ГБ */
const VRAM: Record<string, number> = {
  'rtx-5090': 32,
  'rtx-5080': 16,
  'rtx-5070-ti': 16,
  'rtx-5070': 12,
  'rtx-5060-ti-16': 16,
  'rtx-5060-ti-8': 8,
  'rtx-5060': 8,
  'rtx-5050': 8,
  'rtx-4060': 8,
  'rx-9070-xt': 16,
  'rx-9070': 16,
  'rx-9060-xt-16': 16,
  'rx-9060-xt-8': 8,
  'rx-7600': 8,
  'arc-b580': 12,
  'arc-b570': 10,
};

export const gpuPerf: GpuSeed[] = (
  [
    nvidia('rtx-5090', 'GeForce RTX 5090', 1.55, 1.85, 2.1, 2.2, 'mfg'),
    nvidia('rtx-5080', 'GeForce RTX 5080', 1.35, 1.45, 1.5, 1.55, 'mfg'),
    nvidia('rtx-5070-ti', 'GeForce RTX 5070 Ti', 1.18, 1.22, 1.25, 1.3, 'mfg'),
    nvidia('rtx-5070', 'GeForce RTX 5070', 1.0, 1.0, 1.0, 1.0, 'mfg'),
    nvidia('rtx-5060-ti-16', 'GeForce RTX 5060 Ti 16GB', 0.78, 0.75, 0.72, 0.74, 'mfg'),
    nvidia('rtx-5060-ti-8', 'GeForce RTX 5060 Ti 8GB', 0.76, 0.7, 0.6, 0.66, 'mfg'),
    nvidia('rtx-5060', 'GeForce RTX 5060', 0.66, 0.62, 0.55, 0.6, 'mfg'),
    nvidia('rtx-5050', 'GeForce RTX 5050', 0.5, 0.46, 0.4, 0.45, 'mfg'),
    nvidia('rtx-4060', 'GeForce RTX 4060', 0.58, 0.54, 0.48, 0.52, 'fg'),
    amd('rx-9070-xt', 'Radeon RX 9070 XT', 1.15, 1.17, 1.18, 0.98, true),
    amd('rx-9070', 'Radeon RX 9070', 1.03, 1.05, 1.06, 0.88, true),
    amd('rx-9060-xt-16', 'Radeon RX 9060 XT 16GB', 0.72, 0.7, 0.66, 0.58, true),
    amd('rx-9060-xt-8', 'Radeon RX 9060 XT 8GB', 0.7, 0.65, 0.55, 0.54, true),
    amd('rx-7600', 'Radeon RX 7600', 0.55, 0.5, 0.43, 0.36, false),
    intel('arc-b580', 'Arc B580', 0.6, 0.6, 0.57, 0.55),
    intel('arc-b570', 'Arc B570', 0.52, 0.51, 0.47, 0.47),
  ] satisfies Omit<GpuSeed, 'vramGb'>[]
).map((g) => ({ ...g, vramGb: VRAM[g.key] ?? 8 }));

const cpu = (
  key: string,
  name: string,
  gamingIndex: number,
  multiThreadIndex: number,
): CpuPerf => ({ key, name, gamingIndex, multiThreadIndex });

export const cpuPerf: CpuPerf[] = [
  cpu('ryzen-5-7500f', 'Ryzen 5 7500F', 0.68, 0.52),
  cpu('ryzen-5-7600', 'Ryzen 5 7600', 0.7, 0.54),
  cpu('ryzen-7-7700', 'Ryzen 7 7700', 0.74, 0.7),
  cpu('ryzen-7-7800x3d', 'Ryzen 7 7800X3D', 0.91, 0.66),
  cpu('ryzen-9-7900x', 'Ryzen 9 7900X', 0.76, 1.0),
  cpu('ryzen-5-9600x', 'Ryzen 5 9600X', 0.76, 0.58),
  cpu('ryzen-7-9700x', 'Ryzen 7 9700X', 0.79, 0.74),
  cpu('ryzen-7-9800x3d', 'Ryzen 7 9800X3D', 1.0, 0.78),
  cpu('ryzen-9-9900x', 'Ryzen 9 9900X', 0.8, 1.05),
  cpu('ryzen-9-9950x', 'Ryzen 9 9950X', 0.81, 1.35),
  cpu('ryzen-9-9950x3d', 'Ryzen 9 9950X3D', 0.99, 1.35),
  cpu('ryzen-5-5600', 'Ryzen 5 5600', 0.52, 0.42),
  cpu('ryzen-7-5700x', 'Ryzen 7 5700X', 0.56, 0.55),
  cpu('ryzen-7-5700x3d', 'Ryzen 7 5700X3D', 0.66, 0.52),
  cpu('core-i3-12100f', 'Core i3-12100F', 0.45, 0.3),
  cpu('core-i5-12400f', 'Core i5-12400F', 0.55, 0.45),
  cpu('core-i5-13400f', 'Core i5-13400F', 0.6, 0.58),
  cpu('core-i5-14600k', 'Core i5-14600K', 0.76, 0.88),
  cpu('core-i7-14700k', 'Core i7-14700K', 0.81, 1.12),
  cpu('core-i9-14900k', 'Core i9-14900K', 0.84, 1.25),
  cpu('core-ultra-5-245k', 'Core Ultra 5 245K', 0.73, 0.85),
  cpu('core-ultra-7-265k', 'Core Ultra 7 265K', 0.78, 1.15),
  cpu('core-ultra-9-285k', 'Core Ultra 9 285K', 0.82, 1.38),
];
