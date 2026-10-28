import type { AnyCatalogProduct, CatalogProduct } from '@redcore/domain';
import { formatNumber, type Locale } from '@redcore/i18n';

// Короткие описания по шаблону из характеристик (source = 'template').
// Полные продающие тексты RU/UZ генерирует админ-агент на этапе 10.

type Dict = Record<Locale, string>;
const join = (parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' · ');
const n = (value: number, locale: Locale, digits = 0) => formatNumber(value, locale, digits);

const capacity = (gb: number, locale: Locale) =>
  gb >= 1000
    ? `${n(gb / 1000, locale, 1)} ${locale === 'ru' ? 'ТБ' : 'TB'}`
    : `${gb} ${locale === 'ru' ? 'ГБ' : 'GB'}`;

const connection: Record<string, Dict> = {
  wired: { ru: 'проводная', uz: 'simli' },
  wireless: { ru: 'беспроводная', uz: 'simsiz' },
  'tri-mode': { ru: 'радио, Bluetooth и провод', uz: 'radio, Bluetooth va sim' },
};

function cpu(p: CatalogProduct<'cpu'>, l: Locale) {
  const s = p.specs;
  return l === 'ru'
    ? join([
        `${s.cores} ядер, ${s.threads} потоков, до ${n(s.boostClockGhz, l, 1)} ГГц`,
        `сокет ${s.socket}`,
        `TDP ${s.tdpW} Вт`,
        s.integratedGraphics && 'встроенная графика',
        s.includesCooler && 'кулер в комплекте',
      ])
    : join([
        `${s.cores} yadro, ${s.threads} oqim, ${n(s.boostClockGhz, l, 1)} GGs gacha`,
        `${s.socket} soketi`,
        `TDP ${s.tdpW} Vt`,
        s.integratedGraphics && 'oʻrnatilgan grafika',
        s.includesCooler && 'kuler toʻplamda',
      ]);
}

function gpu(p: CatalogProduct<'gpu'>, l: Locale) {
  const s = p.specs;
  const power = s.powerConnectors.h12v2x6 > 0 ? '12V-2x6' : `${s.powerConnectors.pcie8}× 8-pin`;
  return l === 'ru'
    ? join([
        `${s.vramGb} ГБ ${s.vramType}`,
        `длина ${s.lengthMm} мм, ${n(s.slotWidth, l, 1)} слота`,
        `${s.tbpW} Вт, БП от ${s.recommendedPsuW} Вт`,
        `питание ${power}`,
      ])
    : join([
        `${s.vramGb} GB ${s.vramType}`,
        `uzunligi ${s.lengthMm} mm, ${n(s.slotWidth, l, 1)} slot`,
        `${s.tbpW} Vt, ${s.recommendedPsuW} Vt dan quvvat bloki`,
        `quvvat ${power}`,
      ]);
}

function motherboard(p: CatalogProduct<'motherboard'>, l: Locale) {
  const s = p.specs;
  const wifi = s.wifi !== 'none' && 'Wi-Fi';
  return l === 'ru'
    ? join([
        `сокет ${s.socket}, чипсет ${s.chipset}`,
        s.formFactor,
        `${s.memoryType}, ${s.memorySlots} слота до ${s.maxMemoryGb} ГБ`,
        `${s.m2Slots.length} × M.2`,
        wifi,
      ])
    : join([
        `${s.socket} soketi, ${s.chipset} chipseti`,
        s.formFactor,
        `${s.memoryType}, ${s.memorySlots} slot, ${s.maxMemoryGb} GB gacha`,
        `${s.m2Slots.length} × M.2`,
        wifi,
      ]);
}

function ram(p: CatalogProduct<'ram'>, l: Locale) {
  const s = p.specs;
  const per = s.capacityGb / s.modules;
  return l === 'ru'
    ? join([
        `${s.capacityGb} ГБ (${s.modules} × ${per} ГБ) ${s.type}-${s.speedMts}, CL${s.casLatency}`,
        s.rgb && 'RGB',
        `высота ${s.heightMm} мм`,
      ])
    : join([
        `${s.capacityGb} GB (${s.modules} × ${per} GB) ${s.type}-${s.speedMts}, CL${s.casLatency}`,
        s.rgb && 'RGB',
        `balandligi ${s.heightMm} mm`,
      ]);
}

function storage(p: CatalogProduct<'storage'>, l: Locale) {
  const s = p.specs;
  const gen = s.interface.replace('pcie', '');
  const kind: Dict =
    s.kind === 'nvme'
      ? { ru: `NVMe M.2, PCIe ${gen}.0`, uz: `NVMe M.2, PCIe ${gen}.0` }
      : s.kind === 'sata-ssd'
        ? { ru: 'SATA SSD 2,5″', uz: 'SATA SSD 2,5″' }
        : { ru: `HDD 3,5″, ${s.rpm} об/мин`, uz: `HDD 3,5″, ${s.rpm} ayl/daq` };
  return l === 'ru'
    ? join([
        capacity(s.capacityGb, l),
        kind.ru,
        `чтение до ${n(s.readMbs, l)} МБ/с, запись до ${n(s.writeMbs, l)} МБ/с`,
      ])
    : join([
        capacity(s.capacityGb, l),
        kind.uz,
        `oʻqish ${n(s.readMbs, l)} MB/s gacha, yozish ${n(s.writeMbs, l)} MB/s gacha`,
      ]);
}

const modular: Record<string, Dict> = {
  full: { ru: 'полностью модульный', uz: 'toʻliq modulli' },
  semi: { ru: 'полумодульный', uz: 'yarim modulli' },
  none: { ru: 'немодульный', uz: 'modulsiz' },
};

function psu(p: CatalogProduct<'psu'>, l: Locale) {
  const s = p.specs;
  const efficiency = `80 PLUS ${s.efficiency[0]!.toUpperCase()}${s.efficiency.slice(1)}`;
  const gpuPower = s.connectors.h12v2x6 > 0 ? '12V-2x6' : `${s.connectors.pcie8}× PCIe 8-pin`;
  return join([
    `${s.wattage} ${l === 'ru' ? 'Вт' : 'Vt'}`,
    efficiency,
    `${s.formFactor} ${s.atxVersion}`,
    modular[s.modular]![l],
    gpuPower,
  ]);
}

function pcCase(p: CatalogProduct<'case'>, l: Locale) {
  const s = p.specs;
  const boards = s.supportedMotherboards.join(' / ');
  return l === 'ru'
    ? join([
        s.dualChamber ? 'двухкамерный' : s.formFactor === 'sff' ? 'компактный SFF' : s.formFactor,
        boards,
        `видеокарта до ${s.maxGpuLengthMm} мм, кулер до ${s.maxCoolerHeightMm} мм`,
        s.includedFans > 0 && `${s.includedFans} вентилятора в комплекте`,
      ])
    : join([
        s.dualChamber ? 'ikki kamerali' : s.formFactor === 'sff' ? 'ixcham SFF' : s.formFactor,
        boards,
        `videokarta ${s.maxGpuLengthMm} mm gacha, kuler ${s.maxCoolerHeightMm} mm gacha`,
        s.includedFans > 0 && `toʻplamda ${s.includedFans} ta ventilyator`,
      ]);
}

function cooler(p: CatalogProduct<'cooler'>, l: Locale) {
  const s = p.specs;
  const fans = `${s.fans} × ${s.fanSizeMm} ${l === 'ru' ? 'мм' : 'mm'}`;
  if (s.kind === 'aio') {
    return l === 'ru'
      ? join([
          `СЖО ${s.radiatorMm} мм`,
          `до ${s.tdpRatingW} Вт`,
          fans,
          s.pumpDisplay && 'дисплей на помпе',
        ])
      : join([
          `suyuq sovutish ${s.radiatorMm} mm`,
          `${s.tdpRatingW} Vt gacha`,
          fans,
          s.pumpDisplay && 'pompada displey',
        ]);
  }
  return l === 'ru'
    ? join([
        s.lowProfile ? 'низкопрофильный кулер' : 'башенный кулер',
        `до ${s.tdpRatingW} Вт`,
        `высота ${s.heightMm} мм`,
        fans,
      ])
    : join([
        s.lowProfile ? 'past profilli kuler' : 'minorali kuler',
        `${s.tdpRatingW} Vt gacha`,
        `balandligi ${s.heightMm} mm`,
        fans,
      ]);
}

function caseFan(p: CatalogProduct<'case_fan'>, l: Locale) {
  const s = p.specs;
  return l === 'ru'
    ? join([
        s.packCount > 1 && `${s.packCount} шт.`,
        `${s.sizeMm} мм`,
        `до ${n(s.maxRpm, l)} об/мин`,
        `${n(s.airflowCfm, l, 1)} CFM`,
        `${n(s.noiseDb, l, 1)} дБ`,
        s.lighting !== 'none' && 'ARGB',
      ])
    : join([
        s.packCount > 1 && `${s.packCount} dona`,
        `${s.sizeMm} mm`,
        `${n(s.maxRpm, l)} ayl/daq gacha`,
        `${n(s.airflowCfm, l, 1)} CFM`,
        `${n(s.noiseDb, l, 1)} dB`,
        s.lighting !== 'none' && 'ARGB',
      ]);
}

function monitor(p: CatalogProduct<'monitor'>, l: Locale) {
  const s = p.specs;
  return join([
    `${n(s.sizeInch, l, 1)}″ ${s.panel}`,
    `${s.resolution.width}×${s.resolution.height}`,
    `${s.refreshHz} ${l === 'ru' ? 'Гц' : 'Gs'}`,
    `${n(s.responseMs, l, 2)} ${l === 'ru' ? 'мс' : 'ms'}`,
    s.curved && (l === 'ru' ? 'изогнутый' : 'egilgan'),
    s.hdr !== 'none' && 'HDR',
  ]);
}

const keyboardForm: Record<string, Dict> = {
  full: { ru: 'полноразмерная', uz: 'toʻliq oʻlchamli' },
  tkl: { ru: 'TKL без цифрового блока', uz: 'raqamli bloksiz TKL' },
  '75': { ru: 'формат 75%', uz: '75% format' },
  '65': { ru: 'формат 65%', uz: '65% format' },
  '60': { ru: 'формат 60%', uz: '60% format' },
};

function keyboard(p: CatalogProduct<'keyboard'>, l: Locale) {
  const s = p.specs;
  return join([
    keyboardForm[s.formFactor]![l],
    s.switchType,
    connection[s.connection]![l],
    s.rgb && 'RGB',
    s.hotSwap && 'hot-swap',
  ]);
}

function mouse(p: CatalogProduct<'mouse'>, l: Locale) {
  const s = p.specs;
  return join([
    s.sensor,
    l === 'ru' ? `до ${n(s.maxDpi, l)} DPI` : `${n(s.maxDpi, l)} DPI gacha`,
    `${s.weightG} ${l === 'ru' ? 'г' : 'g'}`,
    connection[s.connection]![l],
  ]);
}

function headset(p: CatalogProduct<'headset'>, l: Locale) {
  const s = p.specs;
  return l === 'ru'
    ? join([
        connection[s.connection]!.ru,
        `драйверы ${s.driverMm} мм`,
        s.microphone && 'микрофон',
        s.surround && 'объёмный звук',
        `${s.weightG} г`,
      ])
    : join([
        connection[s.connection]!.uz,
        `${s.driverMm} mm dinamiklar`,
        s.microphone && 'mikrofon',
        s.surround && 'hajmli ovoz',
        `${s.weightG} g`,
      ]);
}

const surface: Record<string, Dict> = {
  cloth: { ru: 'тканевый', uz: 'matoli' },
  hybrid: { ru: 'гибридный', uz: 'gibrid' },
  hard: { ru: 'жёсткий', uz: 'qattiq' },
  glass: { ru: 'стеклянный', uz: 'shisha' },
};

function mousepad(p: CatalogProduct<'mousepad'>, l: Locale) {
  const s = p.specs;
  const mm = l === 'ru' ? 'мм' : 'mm';
  return join([
    `${s.widthMm}×${s.heightMm} ${mm}`,
    l === 'ru' ? `толщина ${n(s.thicknessMm, l, 1)} мм` : `qalinligi ${n(s.thicknessMm, l, 1)} mm`,
    surface[s.surface]![l],
    s.rgb && (l === 'ru' ? 'RGB-подсветка' : 'RGB yoritish'),
  ]);
}

function webcam(p: CatalogProduct<'webcam'>, l: Locale) {
  const s = p.specs;
  return l === 'ru'
    ? join([
        s.resolution === '4k' ? '4K' : s.resolution,
        `${s.fps} кадр/с`,
        s.autofocus && 'автофокус',
        s.microphone && 'микрофон',
      ])
    : join([
        s.resolution === '4k' ? '4K' : s.resolution,
        `${s.fps} kadr/s`,
        s.autofocus && 'avtofokus',
        s.microphone && 'mikrofon',
      ]);
}

/** Описание готовой сборки собирается из её компонентов. */
export function describePrebuilt(components: AnyCatalogProduct[], l: Locale): string {
  const pick = (type: string) => components.find((c) => c.componentType === type);
  const cpuName = pick('cpu')?.name;
  const gpuName = pick('gpu')?.name;
  const memory = pick('ram');
  const drive = pick('storage');
  const memoryText =
    memory?.componentType === 'ram'
      ? `${memory.specs.capacityGb} ${l === 'ru' ? 'ГБ' : 'GB'} ${memory.specs.type}`
      : undefined;
  const driveText =
    drive?.componentType === 'storage' ? `SSD ${capacity(drive.specs.capacityGb, l)}` : undefined;
  const tail =
    l === 'ru' ? 'собран и протестирован в RedCore' : 'RedCore’da yigʻilgan va sinovdan oʻtgan';
  return join([cpuName, gpuName, memoryText, driveText, tail]);
}

export function describe(product: AnyCatalogProduct, locale: Locale): string {
  switch (product.componentType) {
    case 'cpu':
      return cpu(product, locale);
    case 'gpu':
      return gpu(product, locale);
    case 'motherboard':
      return motherboard(product, locale);
    case 'ram':
      return ram(product, locale);
    case 'storage':
      return storage(product, locale);
    case 'psu':
      return psu(product, locale);
    case 'case':
      return pcCase(product, locale);
    case 'cooler':
      return cooler(product, locale);
    case 'case_fan':
      return caseFan(product, locale);
    case 'monitor':
      return monitor(product, locale);
    case 'keyboard':
      return keyboard(product, locale);
    case 'mouse':
      return mouse(product, locale);
    case 'headset':
      return headset(product, locale);
    case 'mousepad':
      return mousepad(product, locale);
    case 'webcam':
      return webcam(product, locale);
    case 'prebuilt':
      return '';
  }
}
