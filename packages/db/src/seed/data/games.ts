import type { GameData, Preset, Resolution } from '@redcore/domain';

// 20 игр калькулятора FPS (план, §13; актуально на октябрь 2026).
// G — FPS эталонной RTX 5070 при 1440p по пресетам Низкие/Средние/Высокие/Ультра (без RT и апскейла),
// 1080p и 4K получаются коэффициентами разрешения. C — потолок Ryzen 7 9800X3D по пресетам.
// Числа — стартовая оценка по сводкам публичных обзоров; админ правит их в консоли, а
// `pnpm fps:calibrate` уточняет α и поправки вендоров по реальным замерам.

export type GameSeed = GameData & {
  steamAppId: number | null;
  /** Акцент карточки без обложки */
  hue: number;
  sort: number;
};

type Quad = [number, number, number, number];

interface GameInput {
  slug: string;
  name: string;
  profile?: GameData['profile'];
  /** G при 1440p: low, medium, high, ultra */
  g1440: Quad;
  /** C: low, medium, high, ultra */
  cpu: Quad;
  alpha: number;
  bias?: GameData['vendorBias'];
  /** Видеопамять при 1440p Ultra, ГБ */
  vram: number;
  ram: [number, number];
  supports: GameData['supports'];
  steamAppId: number | null;
  hue: number;
  /** Коэффициенты разрешения: 1080p к 1440p и 4K к 1440p */
  res?: [number, number];
  fpsCap?: number;
}

const PRESETS: Preset[] = ['low', 'medium', 'high', 'ultra'];
const VRAM_PRESET = [0.62, 0.76, 0.88, 1];
const VRAM_RES: Record<Resolution, number> = { '1080p': 0.86, '1440p': 1, '2160p': 1.28 };

const all = { dlss: true, fsr: true, xess: true, frameGen: true };

function game(input: GameInput, sort: number): GameSeed {
  const [r1080, r2160] = input.res ?? [1.36, 0.52];
  const profile = input.profile ?? 'aaa';
  const atRes = (factor: number) =>
    Object.fromEntries(PRESETS.map((p, i) => [p, Math.round(input.g1440[i]! * factor)])) as Record<
      Preset,
      number
    >;
  const vramAt = (res: Resolution) =>
    Object.fromEntries(
      PRESETS.map((p, i) => [
        p,
        Math.round(input.vram * VRAM_PRESET[i]! * VRAM_RES[res] * 10) / 10,
      ]),
    ) as Record<Preset, number>;
  return {
    slug: input.slug,
    name: input.name,
    profile,
    cpuAlpha: input.alpha,
    vendorBias: input.bias ?? {},
    ramMinGb: input.ram[0],
    ramRecGb: input.ram[1],
    supports: input.supports,
    thresholds:
      profile === 'competitive' ? { good: 144, playable: 60 } : { good: 60, playable: 30 },
    lowRatio: profile === 'competitive' ? 0.62 : 0.78,
    fpsCap: input.fpsCap ?? null,
    gpuFps: { '1080p': atRes(r1080), '1440p': atRes(1), '2160p': atRes(r2160) },
    vramGb: { '1080p': vramAt('1080p'), '1440p': vramAt('1440p'), '2160p': vramAt('2160p') },
    cpuFps: Object.fromEntries(PRESETS.map((p, i) => [p, input.cpu[i]!])) as Record<Preset, number>,
    steamAppId: input.steamAppId,
    hue: input.hue,
    sort,
  };
}

const inputs: GameInput[] = [
  {
    slug: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    g1440: [142, 116, 96, 78],
    cpu: [215, 198, 182, 166],
    alpha: 0.8,
    vram: 9,
    ram: [12, 16],
    supports: all,
    steamAppId: 1091500,
    hue: 52,
  },
  {
    slug: 'alan-wake-2',
    name: 'Alan Wake 2',
    g1440: [96, 80, 66, 55],
    cpu: [190, 176, 164, 150],
    alpha: 0.65,
    bias: { amd: 0.95 },
    vram: 10.5,
    ram: [16, 16],
    supports: all,
    steamAppId: null,
    hue: 200,
  },
  {
    slug: 'black-myth-wukong',
    name: 'Black Myth: Wukong',
    g1440: [106, 88, 72, 58],
    cpu: [200, 182, 166, 150],
    alpha: 0.65,
    vram: 9.5,
    ram: [16, 16],
    supports: all,
    steamAppId: 2358720,
    hue: 32,
  },
  {
    slug: 'msfs-2024',
    name: 'Microsoft Flight Simulator 2024',
    g1440: [96, 80, 62, 50],
    cpu: [122, 106, 92, 80],
    alpha: 0.95,
    vram: 11,
    ram: [16, 32],
    supports: all,
    steamAppId: 2537590,
    hue: 205,
  },
  {
    slug: 'indiana-jones-great-circle',
    name: 'Indiana Jones and the Great Circle',
    g1440: [150, 126, 104, 88],
    cpu: [222, 202, 186, 170],
    alpha: 0.7,
    vram: 12,
    ram: [16, 32],
    supports: all,
    steamAppId: 2677660,
    hue: 40,
  },
  {
    slug: 'stalker-2',
    name: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl',
    g1440: [100, 83, 68, 57],
    cpu: [132, 116, 102, 90],
    alpha: 0.95,
    vram: 9.5,
    ram: [16, 32],
    supports: all,
    steamAppId: 1643320,
    hue: 90,
  },
  {
    slug: 'monster-hunter-wilds',
    name: 'Monster Hunter Wilds',
    g1440: [104, 90, 76, 64],
    cpu: [126, 112, 98, 88],
    alpha: 0.9,
    bias: { amd: 1.03 },
    vram: 11,
    ram: [16, 16],
    supports: all,
    steamAppId: 2246340,
    hue: 25,
  },
  {
    slug: 'assassins-creed-shadows',
    name: "Assassin's Creed Shadows",
    g1440: [100, 85, 70, 58],
    cpu: [152, 136, 122, 110],
    alpha: 0.8,
    bias: { amd: 1.04 },
    vram: 10,
    ram: [16, 16],
    supports: all,
    steamAppId: 3159330,
    hue: 0,
  },
  {
    slug: 'crimson-desert',
    name: 'Crimson Desert',
    g1440: [94, 78, 62, 50],
    cpu: [162, 146, 130, 118],
    alpha: 0.75,
    vram: 10.5,
    ram: [16, 32],
    supports: all,
    steamAppId: 3321460,
    hue: 350,
  },
  {
    slug: 'resident-evil-requiem',
    name: 'Resident Evil Requiem',
    g1440: [170, 146, 120, 100],
    cpu: [262, 240, 220, 200],
    alpha: 0.6,
    bias: { amd: 1.05 },
    vram: 11,
    ram: [16, 16],
    supports: all,
    steamAppId: null,
    hue: 355,
  },
  {
    slug: 'battlefield-6',
    name: 'Battlefield 6',
    g1440: [190, 160, 136, 116],
    cpu: [240, 212, 186, 166],
    alpha: 0.9,
    bias: { amd: 1.05 },
    vram: 8.5,
    ram: [16, 16],
    supports: all,
    steamAppId: 2807960,
    hue: 210,
  },
  {
    slug: 'call-of-duty-modern-warfare-4',
    name: 'Call of Duty: Modern Warfare 4',
    profile: 'competitive',
    g1440: [220, 186, 156, 130],
    cpu: [300, 272, 242, 216],
    alpha: 0.85,
    bias: { amd: 1.1 },
    vram: 9,
    ram: [16, 16],
    supports: all,
    steamAppId: null,
    hue: 100,
  },
  {
    slug: 'red-dead-redemption-2',
    name: 'Red Dead Redemption 2',
    g1440: [165, 136, 110, 90],
    cpu: [232, 210, 190, 176],
    alpha: 0.7,
    vram: 7,
    ram: [12, 16],
    supports: { dlss: true, fsr: true, xess: false, frameGen: false },
    steamAppId: 1174180,
    hue: 15,
  },
  {
    slug: 'baldurs-gate-3',
    name: "Baldur's Gate 3",
    g1440: [200, 176, 150, 134],
    cpu: [172, 160, 150, 140],
    alpha: 0.9,
    vram: 6,
    ram: [8, 16],
    supports: { dlss: true, fsr: true, xess: false, frameGen: false },
    steamAppId: 1086940,
    hue: 280,
  },
  {
    slug: 'elden-ring',
    name: 'Elden Ring',
    g1440: [180, 156, 130, 110],
    cpu: [200, 186, 172, 160],
    alpha: 0.75,
    vram: 6,
    ram: [12, 16],
    supports: { dlss: false, fsr: false, xess: false, frameGen: false },
    steamAppId: 1245620,
    hue: 45,
    fpsCap: 60,
  },
  {
    slug: 'gta-v-enhanced',
    name: 'Grand Theft Auto V Enhanced',
    g1440: [260, 220, 180, 150],
    cpu: [222, 202, 186, 170],
    alpha: 0.85,
    vram: 6,
    ram: [8, 16],
    supports: { dlss: true, fsr: true, xess: false, frameGen: true },
    steamAppId: 3240220,
    hue: 120,
  },
  {
    slug: 'counter-strike-2',
    name: 'Counter-Strike 2',
    profile: 'competitive',
    g1440: [600, 520, 450, 400],
    cpu: [600, 560, 520, 480],
    alpha: 1,
    vram: 4,
    ram: [8, 16],
    supports: { dlss: false, fsr: true, xess: false, frameGen: false },
    steamAppId: 730,
    hue: 35,
    res: [1.3, 0.55],
  },
  {
    slug: 'dota-2',
    name: 'Dota 2',
    profile: 'competitive',
    g1440: [400, 340, 290, 250],
    cpu: [330, 300, 272, 250],
    alpha: 1,
    vram: 4,
    ram: [8, 16],
    supports: { dlss: false, fsr: true, xess: false, frameGen: false },
    steamAppId: 570,
    hue: 5,
    res: [1.3, 0.55],
  },
  {
    slug: 'valorant',
    name: 'Valorant',
    profile: 'competitive',
    g1440: [800, 700, 600, 520],
    cpu: [700, 650, 600, 560],
    alpha: 1,
    vram: 3,
    ram: [8, 16],
    supports: { dlss: false, fsr: false, xess: false, frameGen: false },
    steamAppId: null,
    hue: 355,
    res: [1.25, 0.6],
  },
  {
    slug: 'pubg-battlegrounds',
    name: 'PUBG: Battlegrounds',
    profile: 'competitive',
    g1440: [330, 280, 230, 190],
    cpu: [300, 272, 242, 220],
    alpha: 0.95,
    vram: 6,
    ram: [8, 16],
    supports: { dlss: true, fsr: true, xess: false, frameGen: false },
    steamAppId: 578080,
    hue: 30,
    res: [1.3, 0.55],
  },
];

export const games: GameSeed[] = inputs.map((input, i) => game(input, i));

/** Обложка с CDN Steam (у игр не из Steam — загрузка из пресс-кита в консоли). */
export function steamCover(appId: number | null): string | null {
  return appId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg` : null;
}
