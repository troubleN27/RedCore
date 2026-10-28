// Фабрика тестовых деталей: разумные значения по умолчанию + точечные переопределения.
import {
  emptyBuild,
  placeProduct,
  type AnyCatalogProduct,
  type Build,
  type CatalogProduct,
  type PerfIndex,
} from '../catalog';
import type { ComponentType } from '../specs/enums';
import type { z } from 'zod';
import { parseSpecs, type specSchemas } from '../specs/schemas';

let sequence = 0;

interface Meta {
  priceUzs?: number;
  stockQty?: number;
  perfKey?: string;
  name?: string;
}

function make<T extends ComponentType>(
  type: T,
  specs: unknown,
  meta: Meta = {},
): CatalogProduct<T> {
  sequence += 1;
  const id = `${type}-${sequence}`;
  return {
    id,
    sku: id.toUpperCase(),
    slug: id,
    name: meta.name ?? `Test ${type} ${sequence}`,
    brand: 'Test',
    componentType: type,
    priceUzs: meta.priceUzs ?? 1_000_000,
    stockQty: meta.stockQty ?? 10,
    specs: parseSpecs(type, specs),
    perfKey: meta.perfKey ?? null,
  };
}

// Входной тип схемы: значения по умолчанию (например, пустые позиции радиаторов) можно не указывать
type Over<T extends ComponentType> = Partial<z.input<(typeof specSchemas)[T]>>;

export const cpu = (over: Over<'cpu'> = {}, meta: Meta = {}) =>
  make(
    'cpu',
    {
      socket: 'AM5',
      family: 'ryzen-9000',
      cores: 8,
      threads: 16,
      baseClockGhz: 3.8,
      boostClockGhz: 5.5,
      l3CacheMb: 32,
      tdpW: 65,
      maxPowerW: 88,
      integratedGraphics: true,
      memoryTypes: ['DDR5'],
      maxMemoryGb: 192,
      maxMemorySpeedMts: 5600,
      pcieGen: 5,
      includesCooler: false,
      unlocked: true,
      ...over,
    },
    { perfKey: 'cpu-mid', ...meta },
  );

export const gpu = (over: Over<'gpu'> = {}, meta: Meta = {}) =>
  make(
    'gpu',
    {
      vendor: 'nvidia',
      chip: 'rtx-5070',
      vramGb: 12,
      vramType: 'GDDR7',
      lengthMm: 300,
      slotWidth: 2.5,
      tbpW: 250,
      recommendedPsuW: 650,
      powerConnectors: { pcie8: 0, h12v2x6: 1 },
      pcieGen: 5,
      pcieLanes: 16,
      fans: 3,
      rgb: false,
      color: 'black',
      outputs: { hdmi: 1, displayPort: 3 },
      ...over,
    },
    meta,
  );

export const motherboard = (over: Over<'motherboard'> = {}, meta: Meta = {}) =>
  make(
    'motherboard',
    {
      socket: 'AM5',
      chipset: 'B850',
      formFactor: 'ATX',
      supportedFamilies: ['ryzen-7000', 'ryzen-8000', 'ryzen-9000'],
      biosUpdateRequiredFor: [],
      memoryType: 'DDR5',
      memorySlots: 4,
      maxMemoryGb: 192,
      maxMemorySpeedMts: 8000,
      m2Slots: [
        { gen: 5, maxLength: 2280, sata: false },
        { gen: 4, maxLength: 2280, sata: false },
        { gen: 4, maxLength: 2280, sata: true },
      ],
      sataPorts: 4,
      pcieGen: 5,
      pcieX16Slots: 1,
      fanHeaders: 6,
      wifi: 'wifi6e',
      bluetooth: true,
      color: 'black',
      ...over,
    },
    meta,
  );

export const ram = (over: Over<'ram'> = {}, meta: Meta = {}) =>
  make(
    'ram',
    {
      type: 'DDR5',
      capacityGb: 32,
      modules: 2,
      speedMts: 6000,
      casLatency: 30,
      heightMm: 35,
      rgb: false,
      color: 'black',
      profile: 'xmp-expo',
      ...over,
    },
    meta,
  );

export const storage = (over: Over<'storage'> = {}, meta: Meta = {}) =>
  make(
    'storage',
    {
      kind: 'nvme',
      formFactor: 'm2-2280',
      interface: 'pcie4',
      capacityGb: 1000,
      readMbs: 7000,
      writeMbs: 6000,
      tbw: 600,
      heatsink: false,
      ...over,
    },
    meta,
  );

export const hdd = (over: Over<'storage'> = {}, meta: Meta = {}) =>
  storage(
    {
      kind: 'hdd',
      formFactor: '3.5',
      interface: 'sata',
      readMbs: 220,
      writeMbs: 220,
      rpm: 7200,
      ...over,
    },
    meta,
  );

export const sataSsd = (over: Over<'storage'> = {}, meta: Meta = {}) =>
  storage(
    {
      kind: 'sata-ssd',
      formFactor: '2.5',
      interface: 'sata',
      readMbs: 560,
      writeMbs: 530,
      ...over,
    },
    meta,
  );

export const psu = (over: Over<'psu'> = {}, meta: Meta = {}) =>
  make(
    'psu',
    {
      wattage: 850,
      efficiency: 'gold',
      formFactor: 'ATX',
      modular: 'full',
      lengthMm: 150,
      atxVersion: '3.1',
      connectors: { pcie8: 3, h12v2x6: 1, eps8: 2, sata: 6 },
      ...over,
    },
    meta,
  );

export const pcCase = (over: Over<'case'> = {}, meta: Meta = {}) =>
  make(
    'case',
    {
      formFactor: 'mid-tower',
      supportedMotherboards: ['ATX', 'mATX', 'Mini-ITX'],
      maxGpuLengthMm: 380,
      maxCoolerHeightMm: 170,
      maxPsuLengthMm: 200,
      psuFormFactors: ['ATX', 'SFX'],
      radiators: { front: [240, 280, 360], top: [240, 360], rear: [120] },
      fanSlots: 9,
      fanSizes: [120, 140],
      includedFans: 3,
      bays25: 2,
      bays35: 2,
      expansionSlots: 7,
      glassPanel: true,
      dualChamber: false,
      color: 'black',
      dimensionsMm: { height: 470, width: 230, depth: 450 },
      ...over,
    },
    meta,
  );

export const airCooler = (over: Record<string, unknown> = {}, meta: Meta = {}) =>
  make(
    'cooler',
    {
      kind: 'air',
      sockets: ['AM5', 'AM4', 'LGA1700', 'LGA1851'],
      tdpRatingW: 250,
      fans: 2,
      fanSizeMm: 120,
      rgb: false,
      color: 'black',
      heightMm: 155,
      lowProfile: false,
      ...over,
    },
    meta,
  );

export const aio = (over: Record<string, unknown> = {}, meta: Meta = {}) =>
  make(
    'cooler',
    {
      kind: 'aio',
      sockets: ['AM5', 'AM4', 'LGA1700', 'LGA1851'],
      tdpRatingW: 300,
      fans: 3,
      fanSizeMm: 120,
      rgb: true,
      color: 'black',
      radiatorMm: 360,
      radiatorThicknessMm: 27,
      pumpDisplay: false,
      ...over,
    },
    meta,
  );

export const caseFan = (over: Over<'case_fan'> = {}, meta: Meta = {}) =>
  make(
    'case_fan',
    {
      sizeMm: 120,
      packCount: 3,
      maxRpm: 1800,
      airflowCfm: 56,
      noiseDb: 22,
      lighting: 'argb',
      connector: '4pin',
      color: 'black',
      ...over,
    },
    meta,
  );

export const perf: PerfIndex = {
  gpu: {
    'rtx-5090': {
      key: 'rtx-5090',
      name: 'RTX 5090',
      vendor: 'nvidia',
      index1080: 1.55,
      index1440: 1.85,
      index2160: 2.1,
      frameGen: 'mfg',
    },
    'rtx-5070': {
      key: 'rtx-5070',
      name: 'RTX 5070',
      vendor: 'nvidia',
      index1080: 1,
      index1440: 1,
      index2160: 1,
      frameGen: 'mfg',
    },
    'rtx-5060': {
      key: 'rtx-5060',
      name: 'RTX 5060',
      vendor: 'nvidia',
      index1080: 0.66,
      index1440: 0.62,
      index2160: 0.55,
      frameGen: 'mfg',
    },
  },
  cpu: {
    'cpu-top': { key: 'cpu-top', name: 'Top', gamingIndex: 1, multiThreadIndex: 1.4 },
    'cpu-mid': { key: 'cpu-mid', name: 'Mid', gamingIndex: 0.78, multiThreadIndex: 1 },
    'cpu-weak': { key: 'cpu-weak', name: 'Weak', gamingIndex: 0.45, multiThreadIndex: 0.4 },
  },
};

/** Полная совместимая сборка без замечаний — от неё тесты отклоняются одной деталью. */
export function completeBuild(): Build {
  const parts: AnyCatalogProduct[] = [
    pcCase(),
    motherboard(),
    cpu(),
    airCooler(),
    ram(),
    gpu(),
    storage(),
    psu(),
  ];
  return parts.reduce((build, part) => placeProduct(build, part), emptyBuild());
}

export function withPart(build: Build, part: AnyCatalogProduct, qty = 1): Build {
  return placeProduct(build, part, qty);
}
