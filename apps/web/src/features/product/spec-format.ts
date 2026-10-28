import { specKeyOrder, type ComponentType } from '@redcore/domain';
import { formatNumber, type Locale } from '@redcore/i18n';
import type { Messages } from '@redcore/i18n/messages';

// Форматирование характеристик для людей: подписи, единицы, перечисления и составные значения.
// Работает и на сервере, и в браузере (страница сравнения) — словарь передаётся явно.

type SpecsDict = Messages['specs'];

export interface SpecFormatContext {
  locale: Locale;
  dict: SpecsDict;
  /** rtx-5070 → GeForce RTX 5070 */
  chipNames: Record<string, string>;
}

export interface SpecRow {
  key: string;
  label: string;
  value: string;
}

const NBSP = ' ';

const numericUnits: Record<string, { unit: keyof SpecsDict['units']; digits?: number }> = {
  baseClockGhz: { unit: 'GHz', digits: 1 },
  boostClockGhz: { unit: 'GHz', digits: 1 },
  l3CacheMb: { unit: 'MB' },
  tdpW: { unit: 'W' },
  maxPowerW: { unit: 'W' },
  tbpW: { unit: 'W' },
  recommendedPsuW: { unit: 'W' },
  wattage: { unit: 'W' },
  tdpRatingW: { unit: 'W' },
  vramGb: { unit: 'GB' },
  maxMemoryGb: { unit: 'GB' },
  speedMts: { unit: 'MT/s' },
  maxMemorySpeedMts: { unit: 'MT/s' },
  lengthMm: { unit: 'mm' },
  heightMm: { unit: 'mm' },
  maxGpuLengthMm: { unit: 'mm' },
  maxCoolerHeightMm: { unit: 'mm' },
  maxPsuLengthMm: { unit: 'mm' },
  fanSizeMm: { unit: 'mm' },
  ramClearanceMm: { unit: 'mm' },
  radiatorMm: { unit: 'mm' },
  radiatorThicknessMm: { unit: 'mm' },
  sizeMm: { unit: 'mm' },
  driverMm: { unit: 'mm' },
  widthMm: { unit: 'mm' },
  thicknessMm: { unit: 'mm', digits: 1 },
  slotWidth: { unit: 'slots', digits: 1 },
  maxGpuSlots: { unit: 'slots', digits: 1 },
  refreshHz: { unit: 'Hz' },
  responseMs: { unit: 'ms', digits: 2 },
  weightG: { unit: 'g' },
  readMbs: { unit: 'MB/s' },
  writeMbs: { unit: 'MB/s' },
  tbw: { unit: 'TB' },
  rpm: { unit: 'rpm' },
  maxRpm: { unit: 'rpm' },
  airflowCfm: { unit: 'CFM', digits: 1 },
  noiseDb: { unit: 'dB', digits: 1 },
  sizeInch: { unit: '″', digits: 1 },
  maxDpi: { unit: 'dpi' },
  fps: { unit: 'fps' },
};

/** Подпись единицы из фильтров категории (unit в БД — латинский код). */
export function unitLabel(unit: string | null, dict: SpecsDict): string {
  if (!unit) return '';
  return (dict.units as Record<string, string>)[unit] ?? unit;
}

function withUnit(value: string, unit: string): string {
  return unit === '″' ? `${value}${unit}` : `${value}${NBSP}${unit}`;
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** Значение перечисления: перевод, если он есть, иначе как есть (AM5, DDR5, IPS…). */
export function enumLabel(key: string, value: string, ctx: SpecFormatContext): string {
  if (key === 'chip') return ctx.chipNames[value] ?? value;
  const values = ctx.dict.values as Record<string, Record<string, string> | undefined>;
  // В словаре нельзя ключи с точкой (ограничение next-intl): «2.5» хранится как «2_5»
  return values[key]?.[value.replaceAll('.', '_')] ?? value;
}

function capacityLabel(gb: number, ctx: SpecFormatContext): string {
  return gb >= 1000
    ? withUnit(formatNumber(gb / 1000, ctx.locale, 1), ctx.dict.units.TB)
    : withUnit(String(gb), ctx.dict.units.GB);
}

/** Одно значение характеристики в читаемом виде; undefined — не показывать строку. */
export function formatSpecValue(
  key: string,
  value: unknown,
  ctx: SpecFormatContext,
): string | undefined {
  const { dict, locale } = ctx;
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value ? dict.boolean.true : dict.boolean.false;

  if (typeof value === 'number') {
    if (key === 'capacityGb') return capacityLabel(value, ctx);
    if (key === 'pcieGen') return `${value}.0`;
    if (key === 'pcieLanes') return `x${value}`;
    if (key === 'casLatency') return `CL${value}`;
    const unit = numericUnits[key];
    const formatted = formatNumber(value, locale, unit?.digits ?? 0);
    return unit ? withUnit(formatted, dict.units[unit.unit]) : formatted;
  }

  if (typeof value === 'string') return enumLabel(key, value, ctx);

  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    if (key === 'm2Slots') {
      const slots = value as { gen: number }[];
      return fill(dict.format.m2, {
        count: slots.length,
        gen: Math.max(...slots.map((s) => s.gen)),
      });
    }
    if (key === 'fanSizes') return withUnit(value.join(' / '), dict.units.mm);
    const itemKey = key === 'supportedFamilies' || key === 'biosUpdateRequiredFor' ? 'family' : key;
    return value.map((item) => enumLabel(itemKey, String(item), ctx)).join(', ');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    switch (key) {
      case 'powerConnectors': {
        const parts = [];
        if (Number(obj.h12v2x6) > 0)
          parts.push(`12V-2x6${Number(obj.h12v2x6) > 1 ? ` × ${obj.h12v2x6}` : ''}`);
        if (Number(obj.pcie8) > 0)
          parts.push(fill(dict.format.pcie8, { count: Number(obj.pcie8) }));
        return parts.join(', ') || undefined;
      }
      case 'connectors':
        return fill(dict.format.connectorsPsu, obj as Record<string, number>);
      case 'outputs':
        return fill(dict.format.outputs, obj as Record<string, number>);
      case 'resolution':
        return `${obj.width} × ${obj.height}`;
      case 'dimensionsMm':
        return withUnit(`${obj.height} × ${obj.width} × ${obj.depth}`, dict.units.mm);
      case 'radiators': {
        const positions = dict.format.radiatorPosition as Record<string, string>;
        const parts = Object.entries(obj)
          .filter(([, sizes]) => Array.isArray(sizes) && sizes.length > 0)
          .map(
            ([position, sizes]) =>
              `${positions[position] ?? position}: ${(sizes as number[]).join('/')}`,
          );
        return parts.length > 0 ? `${parts.join(' · ')}${NBSP}${dict.units.mm}` : undefined;
      }
      default:
        return undefined;
    }
  }
  return String(value);
}

/** Все строки характеристик товара в порядке схемы; пустые и служебные пропускаются. */
export function formatSpecs(
  type: ComponentType,
  specs: Record<string, unknown>,
  ctx: SpecFormatContext,
): SpecRow[] {
  const labels = ctx.dict.labels as Record<string, string>;
  const rows: SpecRow[] = [];
  // Порядок схемы, затем — на всякий случай — ключи, которых в схеме нет
  const keys = [...new Set([...specKeyOrder(type), ...Object.keys(specs)])];
  for (const key of keys) {
    const value = formatSpecValue(key, specs[key], ctx);
    if (value === undefined) continue;
    rows.push({ key, label: labels[key] ?? key, value });
  }
  return rows;
}

/** Ключевые характеристики для карточки товара в списке (2–3 штуки). */
export const cardHighlights: Record<string, string[]> = {
  cpu: ['socket', 'cores', 'boostClockGhz'],
  gpu: ['vramGb', 'lengthMm', 'tbpW'],
  motherboard: ['socket', 'formFactor', 'memoryType'],
  ram: ['capacityGb', 'speedMts', 'casLatency'],
  storage: ['capacityGb', 'interface', 'readMbs'],
  psu: ['wattage', 'efficiency', 'formFactor'],
  case: ['formFactor', 'maxGpuLengthMm', 'maxCoolerHeightMm'],
  cooler: ['kind', 'tdpRatingW', 'heightMm'],
  case_fan: ['sizeMm', 'packCount', 'lighting'],
  monitor: ['sizeInch', 'refreshHz', 'panel'],
  keyboard: ['formFactor', 'connection'],
  mouse: ['weightG', 'connection'],
  headset: ['connection', 'microphone'],
  mousepad: ['surface'],
  webcam: ['resolution', 'fps'],
  prebuilt: ['purpose', 'targetResolution'],
};
