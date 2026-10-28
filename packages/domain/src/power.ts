import type { Build } from './catalog';

export interface PowerReport {
  /** Расчётная пиковая нагрузка системы, Вт */
  loadW: number;
  /** Рекомендуемая мощность БП с запасом и учётом скачков видеокарты, Вт */
  recommendedPsuW: number;
  psuW?: number;
  /** Нагрузка на выбранный БП, % (оптимум 50–70%) */
  loadPercent?: number;
  breakdown: {
    cpu: number;
    gpu: number;
    motherboard: number;
    memory: number;
    storage: number;
    cooling: number;
    peripherals: number;
  };
}

/** Потребление платы по классу чипсета: флагманские X/Z — больше VRM и контроллеров. */
export function motherboardPowerW(chipset: string): number {
  const c = chipset.toUpperCase();
  if (/^(X870E|X670E|Z890|Z790)/.test(c)) return 60;
  if (/^(X870|X670|B850|B650E)/.test(c)) return 50;
  if (/^(B|Z|H7)/.test(c)) return 45;
  return 35; // A620, A520, H610 и подобные
}

const STORAGE_W = { nvme: 7, 'sata-ssd': 4, hdd: 9 } as const;
const FAN_W = 3;
const PUMP_W = 6;
const RGB_DEVICE_W = 2;
/** USB-устройства, периферия, мелочи на плате */
const PERIPHERALS_W = 15;
/** Шаг округления рекомендованной мощности */
const PSU_STEP_W = 50;

export function roundUpToStep(value: number, step = PSU_STEP_W): number {
  return Math.ceil(value / step) * step;
}

/**
 * Пиковая нагрузка = CPU (PPT/PL2) + GPU (TBP) + плата + память + накопители + охлаждение + периферия.
 * Рекомендация = max(нагрузка × 1.25, рекомендация вендора GPU), с округлением вверх до 50 Вт:
 * запас 25% держит БП в зоне высокого КПД, а короткие скачки потребления видеокарты
 * выдерживают блоки стандарта ATX 3.x (до 200% на миллисекунды).
 */
export function computePower(build: Build): PowerReport {
  const cpu = build.cpu?.specs.maxPowerW ?? 0;
  const gpu = build.gpu?.specs.tbpW ?? 0;
  const motherboard = build.motherboard ? motherboardPowerW(build.motherboard.specs.chipset) : 0;

  let memory = 0;
  for (const line of build.ram) {
    const perModule = line.product.specs.type === 'DDR5' ? 5 : 3;
    memory += perModule * line.product.specs.modules * line.qty;
  }

  let storage = 0;
  for (const line of build.storage) storage += STORAGE_W[line.product.specs.kind] * line.qty;

  let cooling = 0;
  let rgbDevices = 0;
  if (build.cooler) {
    cooling += build.cooler.specs.fans * FAN_W;
    if (build.cooler.specs.kind === 'aio') cooling += PUMP_W;
    if (build.cooler.specs.rgb) rgbDevices += 1;
  }
  if (build.case) cooling += build.case.specs.includedFans * FAN_W;
  for (const line of build.case_fan) {
    cooling += line.product.specs.packCount * line.qty * FAN_W;
    if (line.product.specs.lighting !== 'none')
      rgbDevices += line.product.specs.packCount * line.qty;
  }
  for (const line of build.ram) if (line.product.specs.rgb) rgbDevices += line.qty;
  if (build.gpu?.specs.rgb) rgbDevices += 1;

  const anyComponent = Boolean(build.cpu || build.gpu || build.motherboard);
  const peripherals = anyComponent ? PERIPHERALS_W + rgbDevices * RGB_DEVICE_W : 0;

  const loadW = cpu + gpu + motherboard + memory + storage + cooling + peripherals;
  const recommendedPsuW =
    loadW === 0 ? 0 : roundUpToStep(Math.max(loadW * 1.25, build.gpu?.specs.recommendedPsuW ?? 0));

  const report: PowerReport = {
    loadW,
    recommendedPsuW,
    breakdown: { cpu, gpu, motherboard, memory, storage, cooling, peripherals },
  };
  if (build.psu) {
    report.psuW = build.psu.specs.wattage;
    report.loadPercent = Math.round((loadW / build.psu.specs.wattage) * 100);
  }
  return report;
}
