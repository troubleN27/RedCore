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
      { key: 'vramType', type: 'enum' },
      { key: 'fans', type: 'enum' },
      { key: 'rgb', type: 'boolean' },
      { key: 'color', type: 'enum' },
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
      { key: 'casLatency', type: 'range' },
      { key: 'profile', type: 'enum' },
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
      { key: 'formFactor', type: 'enum' },
      { key: 'readMbs', type: 'range', unit: 'MB/s' },
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
      { key: 'atxVersion', type: 'enum' },
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
      { key: 'glassPanel', type: 'boolean' },
      { key: 'dualChamber', type: 'boolean' },
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
      { key: 'rgb', type: 'boolean' },
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
      { key: 'noiseDb', type: 'range', unit: 'dB' },
    ],
  },
  {
    slug: 'monitors',
    type: 'monitor',
    kind: 'peripheral',
    icon: 'monitor',
    ru: {
      name: 'Игровые мониторы',
      description: 'Игровые мониторы IPS и OLED с высокой частотой обновления.',
    },
    uz: {
      name: 'Oʻyin monitorlari',
      description: 'Yuqori yangilanish chastotali IPS va OLED oʻyin monitorlari.',
    },
    filters: [
      { key: 'sizeInch', type: 'range', unit: '″' },
      { key: 'refreshHz', type: 'range', unit: 'Hz' },
      { key: 'panel', type: 'enum' },
      { key: 'resolution', type: 'enum' },
      { key: 'responseMs', type: 'range', unit: 'ms' },
      { key: 'hdr', type: 'enum' },
      { key: 'curved', type: 'boolean' },
    ],
  },
  {
    slug: 'office-monitors',
    type: 'monitor',
    kind: 'peripheral',
    icon: 'monitor',
    ru: {
      name: 'Офисные мониторы',
      description:
        'Мониторы для работы, учёбы и дизайна: чёткая картинка, USB-C, удобная подставка.',
    },
    uz: {
      name: 'Ofis monitorlari',
      description: 'Ish, oʻqish va dizayn uchun monitorlar: aniq tasvir, USB-C, qulay tagliklar.',
    },
    filters: [
      { key: 'sizeInch', type: 'range', unit: '″' },
      { key: 'resolution', type: 'enum' },
      { key: 'panel', type: 'enum' },
      { key: 'refreshHz', type: 'range', unit: 'Hz' },
      { key: 'usbC', type: 'boolean' },
      { key: 'heightAdjust', type: 'boolean' },
    ],
  },
  {
    slug: 'monitor-arms',
    type: 'monitor_arm',
    kind: 'peripheral',
    icon: 'monitor-up',
    ru: {
      name: 'Кронштейны для мониторов',
      description: 'Кронштейны на один, два и три монитора: освобождают стол и подстраивают экран.',
    },
    uz: {
      name: 'Monitor kronshteynlari',
      description:
        'Bir, ikki va uch monitor uchun kronshteynlar: stolni boʻshatadi va ekranni moslaydi.',
    },
    filters: [
      { key: 'monitors', type: 'enum' },
      { key: 'maxSizeInch', type: 'range', unit: '″' },
      { key: 'maxLoadKg', type: 'range', unit: 'kg' },
      { key: 'mount', type: 'enum' },
      { key: 'gasSpring', type: 'boolean' },
      { key: 'color', type: 'enum' },
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
      { key: 'switchType', type: 'enum' },
      { key: 'rgb', type: 'boolean' },
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
      { key: 'maxDpi', type: 'range', unit: 'dpi' },
      { key: 'buttons', type: 'range' },
      { key: 'rgb', type: 'boolean' },
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
      { key: 'microphone', type: 'boolean' },
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
    slug: 'gaming-laptops',
    type: 'laptop',
    kind: 'peripheral',
    icon: 'laptop',
    ru: {
      name: 'Игровые ноутбуки',
      description: 'Ноутбуки с GeForce RTX и быстрыми экранами для игр где угодно.',
    },
    uz: {
      name: 'Oʻyin noutbuklari',
      description: 'GeForce RTX va tezkor ekranli noutbuklar — istalgan joyda oʻyin uchun.',
    },
    filters: [
      { key: 'gpu', type: 'enum' },
      { key: 'cpu', type: 'enum' },
      { key: 'ramGb', type: 'enum', unit: 'GB' },
      { key: 'storageGb', type: 'enum', unit: 'GB' },
      { key: 'screenInch', type: 'enum', unit: '″' },
      { key: 'refreshHz', type: 'range', unit: 'Hz' },
      { key: 'resolution', type: 'enum' },
      { key: 'panel', type: 'enum' },
      { key: 'weightKg', type: 'range', unit: 'kg' },
      { key: 'os', type: 'enum' },
    ],
  },
  {
    slug: 'laptops',
    type: 'laptop',
    kind: 'peripheral',
    icon: 'laptop',
    ru: {
      name: 'Ноутбуки для работы и учёбы',
      description:
        'Лёгкие ноутбуки с долгой работой от батареи: MacBook, Zenbook, ThinkPad и другие.',
    },
    uz: {
      name: 'Ish va oʻqish uchun noutbuklar',
      description:
        'Batareyadan uzoq ishlaydigan yengil noutbuklar: MacBook, Zenbook, ThinkPad va boshqalar.',
    },
    filters: [
      { key: 'gpu', type: 'enum' },
      { key: 'cpu', type: 'enum' },
      { key: 'ramGb', type: 'enum', unit: 'GB' },
      { key: 'storageGb', type: 'enum', unit: 'GB' },
      { key: 'screenInch', type: 'enum', unit: '″' },
      { key: 'refreshHz', type: 'range', unit: 'Hz' },
      { key: 'resolution', type: 'enum' },
      { key: 'panel', type: 'enum' },
      { key: 'weightKg', type: 'range', unit: 'kg' },
      { key: 'os', type: 'enum' },
    ],
  },
  {
    slug: 'gaming-chairs',
    type: 'chair',
    kind: 'peripheral',
    icon: 'armchair',
    ru: {
      name: 'Игровые кресла',
      description: 'Эргономичные игровые кресла с регулировками для долгих сессий.',
    },
    uz: {
      name: 'Oʻyin kreslolari',
      description: 'Uzoq seanslar uchun sozlanadigan ergonomik oʻyin kreslolari.',
    },
    filters: [
      { key: 'material', type: 'enum' },
      { key: 'armrests', type: 'enum' },
      { key: 'maxLoadKg', type: 'range', unit: 'kg' },
      { key: 'reclineDeg', type: 'range', unit: '°' },
      { key: 'lumbar', type: 'boolean' },
      { key: 'footrest', type: 'boolean' },
      { key: 'color', type: 'enum' },
    ],
  },
  {
    slug: 'gaming-desks',
    type: 'desk',
    kind: 'peripheral',
    icon: 'lamp-desk',
    ru: {
      name: 'Игровые столы',
      description:
        'Столы для игрового места: с регулировкой высоты, подсветкой и местом под два монитора.',
    },
    uz: {
      name: 'Oʻyin stollari',
      description:
        'Oʻyin joyi uchun stollar: balandligi sozlanadigan, yoritgichli va ikki monitorga joyli.',
    },
    filters: [
      { key: 'widthMm', type: 'range', unit: 'mm' },
      { key: 'depthMm', type: 'range', unit: 'mm' },
      { key: 'heightAdjust', type: 'enum' },
      { key: 'rgb', type: 'boolean' },
      { key: 'color', type: 'enum' },
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
