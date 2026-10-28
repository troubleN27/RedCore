import type { ComponentType } from '@redcore/domain';

export interface CategorySeed {
  slug: string;
  type: ComponentType;
  kind: 'component' | 'peripheral' | 'prebuilt';
  icon: string;
  ru: { name: string; description: string };
  uz: { name: string; description: string };
  /** Фасетные фильтры: ключ характеристики, тип, единица, участвует ли в совместимости */
  filters: { key: string; type: 'enum' | 'range' | 'boolean'; unit?: string; compat?: boolean }[];
}

export const categories: CategorySeed[] = [
  {
    slug: 'cpu',
    type: 'cpu',
    kind: 'component',
    icon: 'cpu',
    ru: { name: 'Процессоры', description: 'Процессоры AMD Ryzen и Intel Core для игр и работы.' },
    uz: {
      name: 'Protsessorlar',
      description: 'Oʻyin va ish uchun AMD Ryzen va Intel Core protsessorlari.',
    },
    filters: [
      { key: 'socket', type: 'enum', compat: true },
      { key: 'cores', type: 'range' },
      { key: 'boostClockGhz', type: 'range', unit: 'GHz' },
      { key: 'tdpW', type: 'range', unit: 'W' },
      { key: 'integratedGraphics', type: 'boolean' },
      { key: 'includesCooler', type: 'boolean' },
    ],
  },
  {
    slug: 'gpu',
    type: 'gpu',
    kind: 'component',
    icon: 'gpu',
    ru: { name: 'Видеокарты', description: 'Видеокарты NVIDIA GeForce, AMD Radeon и Intel Arc.' },
    uz: {
      name: 'Videokartalar',
      description: 'NVIDIA GeForce, AMD Radeon va Intel Arc videokartalari.',
    },
    filters: [
      { key: 'vendor', type: 'enum' },
      { key: 'chip', type: 'enum' },
      { key: 'vramGb', type: 'range', unit: 'GB' },
      { key: 'lengthMm', type: 'range', unit: 'mm', compat: true },
      { key: 'tbpW', type: 'range', unit: 'W' },
    ],
  },
  {
    slug: 'motherboards',
    type: 'motherboard',
    kind: 'component',
    icon: 'circuit-board',
    ru: {
      name: 'Материнские платы',
      description: 'Платы на AM5, AM4, LGA1851 и LGA1700 всех форм-факторов.',
    },
    uz: {
      name: 'Ona platalar',
      description: 'Barcha form-faktorlardagi AM5, AM4, LGA1851 va LGA1700 platalar.',
    },
    filters: [
      { key: 'socket', type: 'enum', compat: true },
      { key: 'chipset', type: 'enum' },
      { key: 'formFactor', type: 'enum', compat: true },
      { key: 'memoryType', type: 'enum', compat: true },
      { key: 'wifi', type: 'enum' },
    ],
  },
  {
    slug: 'memory',
    type: 'ram',
    kind: 'component',
    icon: 'memory-stick',
    ru: {
      name: 'Оперативная память',
      description: 'Комплекты DDR5 и DDR4 с профилями XMP и EXPO.',
    },
    uz: { name: 'Operativ xotira', description: 'XMP va EXPO profilli DDR5 va DDR4 toʻplamlari.' },
    filters: [
      { key: 'type', type: 'enum', compat: true },
      { key: 'capacityGb', type: 'range', unit: 'GB' },
      { key: 'speedMts', type: 'range', unit: 'MT/s' },
      { key: 'rgb', type: 'boolean' },
    ],
  },
  {
    slug: 'storage',
    type: 'storage',
    kind: 'component',
    icon: 'hard-drive',
    ru: { name: 'Накопители SSD и HDD', description: 'NVMe M.2, SATA SSD и жёсткие диски.' },
    uz: { name: 'SSD va HDD disklar', description: 'NVMe M.2, SATA SSD va qattiq disklar.' },
    filters: [
      { key: 'kind', type: 'enum' },
      { key: 'interface', type: 'enum', compat: true },
      { key: 'capacityGb', type: 'range', unit: 'GB' },
    ],
  },
  {
    slug: 'power-supplies',
    type: 'psu',
    kind: 'component',
    icon: 'plug-zap',
    ru: { name: 'Блоки питания', description: 'Блоки питания ATX 3.1 и SFX с разъёмом 12V-2x6.' },
    uz: {
      name: 'Quvvat bloklari',
      description: '12V-2x6 ulagichli ATX 3.1 va SFX quvvat bloklari.',
    },
    filters: [
      { key: 'wattage', type: 'range', unit: 'W', compat: true },
      { key: 'efficiency', type: 'enum' },
      { key: 'formFactor', type: 'enum', compat: true },
      { key: 'modular', type: 'enum' },
    ],
  },
  {
    slug: 'cases',
    type: 'case',
    kind: 'component',
    icon: 'box',
    ru: { name: 'Корпуса', description: 'Корпуса Mid-Tower, двухкамерные и компактные SFF.' },
    uz: { name: 'Korpuslar', description: 'Mid-Tower, ikki kamerali va ixcham SFF korpuslar.' },
    filters: [
      { key: 'formFactor', type: 'enum' },
      { key: 'maxGpuLengthMm', type: 'range', unit: 'mm', compat: true },
      { key: 'maxCoolerHeightMm', type: 'range', unit: 'mm', compat: true },
      { key: 'color', type: 'enum' },
    ],
  },
  {
    slug: 'cooling',
    type: 'cooler',
    kind: 'component',
    icon: 'fan',
    ru: {
      name: 'Кулеры и СЖО',
      description: 'Башенные кулеры и жидкостное охлаждение для процессора.',
    },
    uz: {
      name: 'Kulerlar va suyuq sovutish',
      description: 'Protsessor uchun minorali kulerlar va suyuq sovutish.',
    },
    filters: [
      { key: 'kind', type: 'enum' },
      { key: 'tdpRatingW', type: 'range', unit: 'W' },
      { key: 'heightMm', type: 'range', unit: 'mm', compat: true },
      { key: 'radiatorMm', type: 'enum', unit: 'mm', compat: true },
    ],
  },
  {
    slug: 'case-fans',
    type: 'case_fan',
    kind: 'component',
    icon: 'wind',
    ru: { name: 'Корпусные вентиляторы', description: 'Вентиляторы 120 и 140 мм, тихие и с ARGB.' },
    uz: {
      name: 'Korpus ventilyatorlari',
      description: '120 va 140 mm ventilyatorlar, jim va ARGB.',
    },
    filters: [
      { key: 'sizeMm', type: 'enum', unit: 'mm', compat: true },
      { key: 'lighting', type: 'enum' },
      { key: 'packCount', type: 'range' },
    ],
  },
  {
    slug: 'monitors',
    type: 'monitor',
    kind: 'peripheral',
    icon: 'monitor',
    ru: { name: 'Мониторы', description: 'Игровые мониторы IPS и OLED с высокой частотой.' },
    uz: { name: 'Monitorlar', description: 'Yuqori chastotali IPS va OLED oʻyin monitorlari.' },
    filters: [
      { key: 'sizeInch', type: 'range', unit: '″' },
      { key: 'refreshHz', type: 'range', unit: 'Hz' },
      { key: 'panel', type: 'enum' },
    ],
  },
  {
    slug: 'keyboards',
    type: 'keyboard',
    kind: 'peripheral',
    icon: 'keyboard',
    ru: { name: 'Клавиатуры', description: 'Механические и магнитные клавиатуры.' },
    uz: { name: 'Klaviaturalar', description: 'Mexanik va magnitli klaviaturalar.' },
    filters: [
      { key: 'formFactor', type: 'enum' },
      { key: 'connection', type: 'enum' },
      { key: 'hotSwap', type: 'boolean' },
    ],
  },
  {
    slug: 'mice',
    type: 'mouse',
    kind: 'peripheral',
    icon: 'mouse',
    ru: { name: 'Мыши', description: 'Лёгкие игровые мыши, проводные и беспроводные.' },
    uz: { name: 'Sichqonchalar', description: 'Yengil oʻyin sichqonchalari, simli va simsiz.' },
    filters: [
      { key: 'connection', type: 'enum' },
      { key: 'weightG', type: 'range', unit: 'g' },
    ],
  },
  {
    slug: 'headsets',
    type: 'headset',
    kind: 'peripheral',
    icon: 'headphones',
    ru: { name: 'Гарнитуры', description: 'Игровые гарнитуры с микрофоном.' },
    uz: { name: 'Quloqchinlar', description: 'Mikrofonli oʻyin quloqchinlari.' },
    filters: [
      { key: 'connection', type: 'enum' },
      { key: 'surround', type: 'boolean' },
    ],
  },
  {
    slug: 'mousepads',
    type: 'mousepad',
    kind: 'peripheral',
    icon: 'square',
    ru: { name: 'Коврики', description: 'Коврики для мыши, в том числе XXL и с подсветкой.' },
    uz: {
      name: 'Sichqoncha gilamchalari',
      description: 'Sichqoncha gilamchalari, jumladan XXL va yoritgichli.',
    },
    filters: [
      { key: 'surface', type: 'enum' },
      { key: 'rgb', type: 'boolean' },
    ],
  },
  {
    slug: 'webcams',
    type: 'webcam',
    kind: 'peripheral',
    icon: 'webcam',
    ru: { name: 'Веб-камеры', description: 'Веб-камеры для стримов и звонков.' },
    uz: { name: 'Veb-kameralar', description: 'Strim va qoʻngʻiroqlar uchun veb-kameralar.' },
    filters: [
      { key: 'resolution', type: 'enum' },
      { key: 'fps', type: 'range' },
    ],
  },
  {
    slug: 'prebuilt-pcs',
    type: 'prebuilt',
    kind: 'prebuilt',
    icon: 'computer',
    ru: { name: 'Готовые ПК', description: 'Собранные и протестированные компьютеры RedCore.' },
    uz: {
      name: 'Tayyor kompyuterlar',
      description: 'RedCore’da yigʻilgan va sinovdan oʻtgan kompyuterlar.',
    },
    filters: [
      { key: 'purpose', type: 'enum' },
      { key: 'targetResolution', type: 'enum' },
    ],
  },
];
