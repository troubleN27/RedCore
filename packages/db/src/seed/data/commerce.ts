import type { LocalizedText } from '../../schema';

export interface ZoneSeed {
  code: string;
  name: LocalizedText;
  priceUzs: number;
  freeFromUzs?: number;
  eta: [number, number];
  codAllowed?: boolean;
  isPickup?: boolean;
}

// Самовывоз и курьер по Ташкенту, регионы — через службы доставки. Бесплатно от суммы заказа.
export const deliveryZones: ZoneSeed[] = [
  {
    code: 'pickup',
    name: { ru: 'Самовывоз из магазина (Ташкент)', uz: 'Doʻkondan olib ketish (Toshkent)' },
    priceUzs: 0,
    eta: [0, 1],
    isPickup: true,
  },
  {
    code: 'tashkent-city',
    name: { ru: 'Ташкент — курьер', uz: 'Toshkent — kuryer' },
    priceUzs: 50_000,
    freeFromUzs: 5_000_000,
    eta: [1, 1],
  },
  {
    code: 'tashkent-region',
    name: { ru: 'Ташкентская область', uz: 'Toshkent viloyati' },
    priceUzs: 80_000,
    freeFromUzs: 8_000_000,
    eta: [1, 2],
  },
  {
    code: 'andijan',
    name: { ru: 'Андижанская область', uz: 'Andijon viloyati' },
    priceUzs: 120_000,
    freeFromUzs: 15_000_000,
    eta: [2, 3],
  },
  {
    code: 'bukhara',
    name: { ru: 'Бухарская область', uz: 'Buxoro viloyati' },
    priceUzs: 120_000,
    freeFromUzs: 15_000_000,
    eta: [2, 3],
  },
  {
    code: 'fergana',
    name: { ru: 'Ферганская область', uz: 'Fargʻona viloyati' },
    priceUzs: 120_000,
    freeFromUzs: 15_000_000,
    eta: [2, 3],
  },
  {
    code: 'jizzakh',
    name: { ru: 'Джизакская область', uz: 'Jizzax viloyati' },
    priceUzs: 100_000,
    freeFromUzs: 15_000_000,
    eta: [1, 2],
  },
  {
    code: 'kashkadarya',
    name: { ru: 'Кашкадарьинская область', uz: 'Qashqadaryo viloyati' },
    priceUzs: 130_000,
    freeFromUzs: 15_000_000,
    eta: [2, 4],
  },
  {
    code: 'khorezm',
    name: { ru: 'Хорезмская область', uz: 'Xorazm viloyati' },
    priceUzs: 150_000,
    freeFromUzs: 20_000_000,
    eta: [3, 5],
  },
  {
    code: 'namangan',
    name: { ru: 'Наманганская область', uz: 'Namangan viloyati' },
    priceUzs: 120_000,
    freeFromUzs: 15_000_000,
    eta: [2, 3],
  },
  {
    code: 'navoi',
    name: { ru: 'Навоийская область', uz: 'Navoiy viloyati' },
    priceUzs: 120_000,
    freeFromUzs: 15_000_000,
    eta: [2, 3],
  },
  {
    code: 'samarkand',
    name: { ru: 'Самаркандская область', uz: 'Samarqand viloyati' },
    priceUzs: 100_000,
    freeFromUzs: 12_000_000,
    eta: [1, 2],
  },
  {
    code: 'surkhandarya',
    name: { ru: 'Сурхандарьинская область', uz: 'Surxondaryo viloyati' },
    priceUzs: 150_000,
    freeFromUzs: 20_000_000,
    eta: [3, 5],
  },
  {
    code: 'syrdarya',
    name: { ru: 'Сырдарьинская область', uz: 'Sirdaryo viloyati' },
    priceUzs: 90_000,
    freeFromUzs: 10_000_000,
    eta: [1, 2],
  },
  {
    code: 'karakalpakstan',
    name: { ru: 'Республика Каракалпакстан', uz: 'Qoraqalpogʻiston Respublikasi' },
    priceUzs: 180_000,
    freeFromUzs: 25_000_000,
    eta: [3, 6],
    codAllowed: false,
  },
];

export const services = [
  {
    key: 'pc_assembly',
    priceUzs: 350_000,
    name: { ru: 'Сборка ПК в магазине', uz: 'Doʻkonda kompyuter yigʻish' },
    description: {
      ru: 'Соберём, уложим кабели, обновим BIOS и прогоним стресс-тест. Гарантия на сборку — 12 месяцев.',
      uz: 'Yigʻamiz, kabellarni joylashtiramiz, BIOS ni yangilaymiz va stress-test oʻtkazamiz. Yigʻishga kafolat — 12 oy.',
    },
  },
  {
    key: 'os_install',
    priceUzs: 150_000,
    name: { ru: 'Установка Windows и драйверов', uz: 'Windows va drayverlarni oʻrnatish' },
    description: {
      ru: 'Чистая установка Windows 11 с актуальными драйверами (лицензия приобретается отдельно).',
      uz: 'Dolzarb drayverlar bilan Windows 11 ni toza oʻrnatish (litsenziya alohida xarid qilinadi).',
    },
  },
] satisfies { key: string; priceUzs: number; name: LocalizedText; description: LocalizedText }[];

export const promoCodes = [
  {
    code: 'REDCORE10',
    type: 'percent' as const,
    value: 10,
    minOrderUzs: 5_000_000,
    maxDiscountUzs: 1_500_000,
    description: { ru: 'Скидка 10% от 5 млн сум', uz: '5 mln soʻmdan 10% chegirma' },
  },
  {
    code: 'WELCOME',
    type: 'fixed' as const,
    value: 200_000,
    minOrderUzs: 3_000_000,
    perUserLimit: 1,
    description: { ru: '200 000 сум на первый заказ', uz: 'Birinchi buyurtmaga 200 000 soʻm' },
  },
  {
    code: 'PERIPHERY15',
    type: 'percent' as const,
    value: 15,
    maxDiscountUzs: 500_000,
    appliesTo: {
      componentTypes: ['monitor', 'keyboard', 'mouse', 'headset', 'mousepad', 'webcam'],
    },
    description: { ru: '15% на периферию', uz: 'Periferiyaga 15%' },
  },
  {
    code: 'SUMMER2026',
    type: 'percent' as const,
    value: 7,
    endsAt: new Date('2026-09-01T00:00:00+05:00'),
    description: { ru: 'Летняя акция (завершена)', uz: 'Yozgi aksiya (yakunlangan)' },
  },
];
