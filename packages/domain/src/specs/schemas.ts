import { z } from 'zod';
import {
  colors,
  componentTypes,
  cpuFamilies,
  fanSizes,
  gpuVendors,
  memoryTypes,
  motherboardFormFactors,
  psuFormFactors,
  radiatorSizes,
  sockets,
  type ComponentType,
} from './enums';

// Характеристики товара хранятся в products.specs (jsonb) и валидируются этими схемами.
// Они же — единый источник правды для движка совместимости, seed, форм админки и MCP.

const int = () => z.number().int();
const positiveInt = () => z.number().int().positive();
const nonNegativeInt = () => z.number().int().nonnegative();
const pcieGen = z.union([z.literal(3), z.literal(4), z.literal(5)]);
const color = z.enum(colors);
const socket = z.enum(sockets);
const radiatorSize = z.union(radiatorSizes.map((size) => z.literal(size)));
const fanSize = z.union(fanSizes.map((size) => z.literal(size)));

export const cpuSpecsSchema = z
  .object({
    socket,
    family: z.enum(cpuFamilies),
    cores: positiveInt(),
    threads: positiveInt(),
    baseClockGhz: z.number().positive(),
    boostClockGhz: z.number().positive(),
    l3CacheMb: positiveInt(),
    /** Номинальный TDP / PBP */
    tdpW: positiveInt(),
    /** Пиковое потребление: PPT у AMD, PL2/MTP у Intel */
    maxPowerW: positiveInt(),
    integratedGraphics: z.boolean(),
    memoryTypes: z.array(z.enum(memoryTypes)).min(1),
    maxMemoryGb: positiveInt(),
    maxMemorySpeedMts: positiveInt(),
    pcieGen,
    includesCooler: z.boolean(),
    unlocked: z.boolean(),
  })
  .refine((s) => s.threads >= s.cores, 'threads must be >= cores')
  .refine((s) => s.boostClockGhz >= s.baseClockGhz, 'boost clock must be >= base clock')
  .refine((s) => s.maxPowerW >= s.tdpW, 'maxPowerW must be >= tdpW');

export const gpuSpecsSchema = z.object({
  vendor: z.enum(gpuVendors),
  /** Ключ чипа в perf_gpu: разные вендорские карты одного чипа делят индекс производительности */
  chip: z.string().min(2),
  vramGb: positiveInt(),
  vramType: z.enum(['GDDR6', 'GDDR6X', 'GDDR7']),
  lengthMm: positiveInt(),
  /** Толщина в слотах расширения (2.5, 3.5…) */
  slotWidth: z.number().min(1).max(5),
  tbpW: positiveInt(),
  recommendedPsuW: positiveInt(),
  powerConnectors: z.object({ pcie8: nonNegativeInt(), h12v2x6: nonNegativeInt() }),
  pcieGen,
  pcieLanes: z.union([z.literal(16), z.literal(8), z.literal(4)]),
  fans: int().min(0).max(4),
  rgb: z.boolean(),
  color,
  outputs: z.object({ hdmi: nonNegativeInt(), displayPort: nonNegativeInt() }),
});

export const motherboardSpecsSchema = z.object({
  socket,
  chipset: z.string().min(2),
  formFactor: z.enum(motherboardFormFactors),
  supportedFamilies: z.array(z.enum(cpuFamilies)).min(1),
  /** Семейства, для которых может понадобиться обновить BIOS */
  biosUpdateRequiredFor: z.array(z.enum(cpuFamilies)).default([]),
  memoryType: z.enum(memoryTypes),
  memorySlots: z.union([z.literal(2), z.literal(4)]),
  maxMemoryGb: positiveInt(),
  maxMemorySpeedMts: positiveInt(),
  m2Slots: z
    .array(
      z.object({
        gen: pcieGen,
        maxLength: z.union([z.literal(2280), z.literal(22110)]),
        sata: z.boolean(),
      }),
    )
    .min(1),
  sataPorts: nonNegativeInt(),
  pcieGen,
  pcieX16Slots: positiveInt(),
  fanHeaders: positiveInt(),
  wifi: z.enum(['none', 'wifi6', 'wifi6e', 'wifi7']),
  bluetooth: z.boolean(),
  color,
});

export const ramSpecsSchema = z
  .object({
    type: z.enum(memoryTypes),
    /** Суммарный объём комплекта */
    capacityGb: positiveInt(),
    modules: positiveInt().max(4),
    speedMts: positiveInt(),
    casLatency: positiveInt(),
    heightMm: positiveInt(),
    rgb: z.boolean(),
    color,
    profile: z.enum(['none', 'xmp', 'expo', 'xmp-expo']),
  })
  .refine((s) => s.capacityGb % s.modules === 0, 'capacity must divide evenly by modules');

export const storageSpecsSchema = z
  .object({
    kind: z.enum(['nvme', 'sata-ssd', 'hdd']),
    formFactor: z.enum(['m2-2280', '2.5', '3.5']),
    interface: z.enum(['pcie3', 'pcie4', 'pcie5', 'sata']),
    capacityGb: positiveInt(),
    readMbs: positiveInt(),
    writeMbs: positiveInt(),
    tbw: positiveInt().optional(),
    rpm: positiveInt().optional(),
    heatsink: z.boolean(),
  })
  .refine(
    (s) =>
      s.kind === 'nvme'
        ? s.formFactor === 'm2-2280' && s.interface !== 'sata'
        : s.interface === 'sata' && s.formFactor !== 'm2-2280',
    'nvme must be M.2 PCIe; SATA SSD/HDD must be 2.5"/3.5" SATA',
  )
  .refine((s) => s.kind !== 'hdd' || s.rpm !== undefined, 'hdd must declare rpm');

export const psuSpecsSchema = z.object({
  wattage: positiveInt(),
  efficiency: z.enum(['white', 'bronze', 'gold', 'platinum', 'titanium']),
  formFactor: z.enum(psuFormFactors),
  modular: z.enum(['full', 'semi', 'none']),
  lengthMm: positiveInt(),
  atxVersion: z.enum(['2.x', '3.0', '3.1']),
  connectors: z.object({
    pcie8: nonNegativeInt(),
    h12v2x6: nonNegativeInt(),
    eps8: positiveInt(),
    sata: nonNegativeInt(),
  }),
});

const radiatorPositions = z.object({
  front: z.array(radiatorSize).default([]),
  top: z.array(radiatorSize).default([]),
  side: z.array(radiatorSize).default([]),
  bottom: z.array(radiatorSize).default([]),
  rear: z.array(radiatorSize).default([]),
});

export const caseSpecsSchema = z.object({
  formFactor: z.enum(['full-tower', 'mid-tower', 'mini-tower', 'sff']),
  supportedMotherboards: z.array(z.enum(motherboardFormFactors)).min(1),
  maxGpuLengthMm: positiveInt(),
  /** Ограничение толщины видеокарты (актуально для SFF) */
  maxGpuSlots: z.number().positive().optional(),
  maxCoolerHeightMm: positiveInt(),
  maxPsuLengthMm: positiveInt(),
  psuFormFactors: z.array(z.enum(psuFormFactors)).min(1),
  radiators: radiatorPositions,
  fanSlots: positiveInt(),
  fanSizes: z.array(fanSize).min(1),
  includedFans: nonNegativeInt(),
  bays25: nonNegativeInt(),
  bays35: nonNegativeInt(),
  expansionSlots: positiveInt(),
  glassPanel: z.boolean(),
  dualChamber: z.boolean(),
  color,
  dimensionsMm: z.object({ height: positiveInt(), width: positiveInt(), depth: positiveInt() }),
});

const coolerBase = {
  sockets: z.array(socket).min(1),
  tdpRatingW: positiveInt(),
  fans: nonNegativeInt(),
  fanSizeMm: positiveInt(),
  rgb: z.boolean(),
  color,
};

export const coolerSpecsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('air'),
    ...coolerBase,
    heightMm: positiveInt(),
    /** Допустимая высота модулей памяти под радиатором; нет — не ограничивает */
    ramClearanceMm: positiveInt().optional(),
    lowProfile: z.boolean(),
  }),
  z.object({
    kind: z.literal('aio'),
    ...coolerBase,
    radiatorMm: radiatorSize,
    radiatorThicknessMm: positiveInt(),
    pumpDisplay: z.boolean(),
  }),
]);

export const caseFanSpecsSchema = z.object({
  sizeMm: fanSize,
  packCount: positiveInt(),
  maxRpm: positiveInt(),
  airflowCfm: z.number().positive(),
  noiseDb: z.number().positive(),
  lighting: z.enum(['none', 'rgb', 'argb']),
  connector: z.enum(['3pin', '4pin']),
  color,
});

const connection = z.enum(['wired', 'wireless', 'tri-mode']);

export const monitorSpecsSchema = z.object({
  sizeInch: z.number().positive(),
  resolution: z.object({ width: positiveInt(), height: positiveInt() }),
  refreshHz: positiveInt(),
  panel: z.enum(['IPS', 'VA', 'TN', 'OLED', 'QD-OLED']),
  responseMs: z.number().positive(),
  curved: z.boolean(),
  hdr: z.enum(['none', 'hdr400', 'hdr600', 'hdr1000', 'true-black-400']),
  adaptiveSync: z.boolean(),
});

export const keyboardSpecsSchema = z.object({
  formFactor: z.enum(['full', 'tkl', '75', '65', '60']),
  switchType: z.string().min(2),
  connection,
  rgb: z.boolean(),
  hotSwap: z.boolean(),
});

export const mouseSpecsSchema = z.object({
  sensor: z.string().min(2),
  maxDpi: positiveInt(),
  weightG: positiveInt(),
  connection,
  buttons: positiveInt(),
  rgb: z.boolean(),
});

export const headsetSpecsSchema = z.object({
  connection,
  driverMm: positiveInt(),
  microphone: z.boolean(),
  surround: z.boolean(),
  weightG: positiveInt(),
});

export const mousepadSpecsSchema = z.object({
  widthMm: positiveInt(),
  heightMm: positiveInt(),
  thicknessMm: z.number().positive(),
  surface: z.enum(['cloth', 'hybrid', 'hard', 'glass']),
  rgb: z.boolean(),
});

export const webcamSpecsSchema = z.object({
  resolution: z.enum(['1080p', '1440p', '4k']),
  fps: positiveInt(),
  autofocus: z.boolean(),
  microphone: z.boolean(),
});

export const prebuiltSpecsSchema = z.object({
  purpose: z.enum(['gaming', 'esports', 'workstation', 'office', 'sff']),
  /** Целевое разрешение для игровых сборок */
  targetResolution: z.enum(['1080p', '1440p', '2160p']).optional(),
});

export const specSchemas = {
  cpu: cpuSpecsSchema,
  gpu: gpuSpecsSchema,
  motherboard: motherboardSpecsSchema,
  ram: ramSpecsSchema,
  storage: storageSpecsSchema,
  psu: psuSpecsSchema,
  case: caseSpecsSchema,
  cooler: coolerSpecsSchema,
  case_fan: caseFanSpecsSchema,
  monitor: monitorSpecsSchema,
  keyboard: keyboardSpecsSchema,
  mouse: mouseSpecsSchema,
  headset: headsetSpecsSchema,
  mousepad: mousepadSpecsSchema,
  webcam: webcamSpecsSchema,
  prebuilt: prebuiltSpecsSchema,
} as const satisfies Record<ComponentType, z.ZodType>;

export type SpecsByType = { [T in ComponentType]: z.output<(typeof specSchemas)[T]> };
export type SpecsOf<T extends ComponentType> = SpecsByType[T];

export type CpuSpecs = SpecsOf<'cpu'>;
export type GpuSpecs = SpecsOf<'gpu'>;
export type MotherboardSpecs = SpecsOf<'motherboard'>;
export type RamSpecs = SpecsOf<'ram'>;
export type StorageSpecs = SpecsOf<'storage'>;
export type PsuSpecs = SpecsOf<'psu'>;
export type CaseSpecs = SpecsOf<'case'>;
export type CoolerSpecs = SpecsOf<'cooler'>;
export type CaseFanSpecs = SpecsOf<'case_fan'>;

/** Проверяет и нормализует характеристики (подставляет значения по умолчанию). */
export function parseSpecs<T extends ComponentType>(type: T, input: unknown): SpecsOf<T> {
  return specSchemas[type].parse(input) as SpecsOf<T>;
}

export function safeParseSpecs<T extends ComponentType>(type: T, input: unknown) {
  return specSchemas[type].safeParse(input);
}

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && (componentTypes as readonly string[]).includes(value);
}

/**
 * Порядок характеристик как в схеме — для таблиц на сайте. JSONB в Postgres не сохраняет
 * порядок ключей, поэтому выводить «как пришло из БД» нельзя.
 */
export function specKeyOrder(type: ComponentType): string[] {
  const schema = specSchemas[type] as unknown as {
    shape?: Record<string, unknown>;
    options?: { shape: Record<string, unknown> }[];
  };
  if (schema.shape) return Object.keys(schema.shape);
  return [...new Set((schema.options ?? []).flatMap((option) => Object.keys(option.shape)))];
}
