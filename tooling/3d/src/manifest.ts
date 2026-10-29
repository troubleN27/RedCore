// Манифест базовых 3D-моделей (план, §12). Все — CC BY 4.0: коммерческое использование
// разрешено, атрибуция обязательна (страница /credits и ASSETS_LICENSES.md).
// Лицензия перепроверяется при скачивании (fetch.ts) — модель с другой лицензией не попадёт в сборку.

export interface ModelEntry {
  /** Ключ подтипа — его же возвращает modelSpecFor().glbKey */
  key: string;
  title: string;
  author: string;
  /** UID модели на Sketchfab */
  uid: string;
  license: 'CC-BY-4.0';
  /** Наибольший габарит детали в миллиметрах — модель масштабируется к нему */
  targetSizeMm: number;
  /** Целевой полигонаж LOD0/LOD1 (треугольники) */
  lod0Triangles: number;
  lod1Triangles: number;
  /**
   * Переименование материалов исходника в общие роли сцены: body (покраска в цвет
   * исполнения), rgb (подсветка), glass. Ключ — подстрока имени материала (без регистра).
   */
  materials?: Record<string, 'body' | 'rgb' | 'glass'>;
}

const sketchfab = (uid: string) => `https://sketchfab.com/3d-models/${uid}`;

export const manifest: ModelEntry[] = [
  {
    key: 'gpu_3fan',
    title: 'MSI RTX 3080 Gaming X Trio',
    author: 'meu9MM98',
    uid: 'e5356746dcec48f9868164bb9674ab9a',
    license: 'CC-BY-4.0',
    targetSizeMm: 323,
    lod0Triangles: 40_000,
    lod1Triangles: 12_000,
    materials: { shroud: 'body', led: 'rgb' },
  },
  {
    key: 'gpu_2fan',
    title: 'NVIDIA RTX 3070',
    author: 'DatSketch',
    uid: '29da4e10eb6c427cb72f3ebdf822f89e',
    license: 'CC-BY-4.0',
    targetSizeMm: 242,
    lod0Triangles: 40_000,
    lod1Triangles: 12_000,
    materials: { body: 'body' },
  },
  {
    key: 'mb_atx',
    title: 'ROG Strix X370-F',
    author: 'MUSHROOM_BUILDS',
    uid: '56bd8923fdf341fd8d81b717055a61dd',
    license: 'CC-BY-4.0',
    targetSizeMm: 305,
    lod0Triangles: 60_000,
    lod1Triangles: 15_000,
  },
  {
    key: 'cpu_am5',
    title: 'AMD Ryzen 7 7800X3D',
    author: 'gioguarino12',
    uid: '209c4aada00e4b1790d8d274bac98779',
    license: 'CC-BY-4.0',
    targetSizeMm: 40,
    // Крышка процессора при 8 тыс. треугольников теряла форму («шипы») — оставляем запас
    lod0Triangles: 24_000,
    lod1Triangles: 8_000,
  },
  // cpu_am4 (AM4 CPU, Igor.Jop) исключён: цельная сетка с текстурами (ножки процессора) не
  // упрощается ниже 41 тыс. треугольников без потери текстур — для AM4 остаётся процедурная модель
  {
    key: 'cpu_intel',
    title: 'INTEL CPU',
    author: 'KuatEntralla3D',
    uid: 'ec11f729b05848488522ba6f8c6f254f',
    license: 'CC-BY-4.0',
    targetSizeMm: 45,
    lod0Triangles: 8_000,
    lod1Triangles: 2_000,
  },
  {
    key: 'ram_rgb',
    title: 'Corsair Dominator RGB',
    author: 'MG990',
    uid: '8995a60d2dcc46b3be14c35c1c016c0a',
    license: 'CC-BY-4.0',
    targetSizeMm: 136,
    lod0Triangles: 20_000,
    lod1Triangles: 6_000,
    materials: { light: 'rgb', heatspreader: 'body' },
  },
  {
    key: 'ram_lowprofile',
    title: 'Corsair Vengeance LPX',
    author: 'supahot',
    uid: 'ee11e1926e514075a70642ecb5dc5c2d',
    license: 'CC-BY-4.0',
    targetSizeMm: 134,
    lod0Triangles: 5_000,
    lod1Triangles: 2_000,
  },
  {
    key: 'ssd_m2',
    title: 'Samsung 990 Pro',
    author: 'lime.ball.animations.official',
    uid: '41b7bfda7eab40f8b13330913fd66fc2',
    license: 'CC-BY-4.0',
    targetSizeMm: 80,
    lod0Triangles: 2_000,
    lod1Triangles: 1_000,
  },
  {
    key: 'ssd_25',
    title: 'SSD NoName SATA',
    author: 'hlupich',
    uid: '5a182a80361f407e965adaaee077e3cd',
    license: 'CC-BY-4.0',
    targetSizeMm: 100,
    lod0Triangles: 4_000,
    lod1Triangles: 1_500,
  },
  {
    key: 'hdd_35',
    title: 'WD Green 1TB',
    author: 'MG990',
    uid: 'e9244f56e0724dd097570e29bae4b7c6',
    license: 'CC-BY-4.0',
    targetSizeMm: 147,
    lod0Triangles: 20_000,
    lod1Triangles: 5_000,
  },
  {
    key: 'psu_atx',
    title: 'PSU Power Supply Unit',
    author: 'Groovex',
    uid: '69ccd1be3a77497cb2acc9e39e7c52b3',
    license: 'CC-BY-4.0',
    targetSizeMm: 160,
    lod0Triangles: 12_000,
    lod1Triangles: 4_000,
    materials: { case: 'body' },
  },
  {
    key: 'fan_120',
    title: 'Lian Li UNI FAN SL120 RGB Black',
    author: 'DIEKO',
    uid: '5abd0d8e89ea4241b7216f4b6d5a2ca4',
    license: 'CC-BY-4.0',
    targetSizeMm: 120,
    lod0Triangles: 4_600,
    lod1Triangles: 2_000,
    materials: { rgb: 'rgb', light: 'rgb' },
  },
  {
    key: 'case_atx',
    title: 'Fractal Design Meshify C',
    author: 'MUSHROOM_BUILDS',
    uid: 'a46526af2ac84fa098edc3f01c012450',
    license: 'CC-BY-4.0',
    targetSizeMm: 453,
    lod0Triangles: 60_000,
    lod1Triangles: 15_000,
    materials: { glass: 'glass', panel: 'body' },
  },
];

export function sourceUrl(entry: ModelEntry): string {
  return sketchfab(entry.uid);
}

/** Бюджеты из плана (§11, этап 6): каждая базовая GLB и весь первый показ 3D. */
export const budgets = {
  lod0Bytes: 1_000_000,
  lod1Bytes: 300_000,
  /** Сумма LOD0 всех моделей сцены конфигуратора (этап 7) на десктопе */
  sceneDesktopBytes: 8_000_000,
  sceneMobileBytes: 3_000_000,
};
