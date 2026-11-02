// Справочники значений характеристик. Подписи для UI — в @redcore/i18n (namespace specs).

export const componentTypes = [
  'cpu',
  'gpu',
  'motherboard',
  'ram',
  'storage',
  'psu',
  'case',
  'cooler',
  'case_fan',
  'monitor',
  'keyboard',
  'mouse',
  'headset',
  'mousepad',
  'webcam',
  'laptop',
  'monitor_arm',
  'chair',
  'desk',
  'prebuilt',
] as const;
export type ComponentType = (typeof componentTypes)[number];

/** Типы, из которых собирается системный блок в конфигураторе. */
export const pcComponentTypes = [
  'case',
  'motherboard',
  'cpu',
  'cooler',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case_fan',
] as const satisfies readonly ComponentType[];
export type PcComponentType = (typeof pcComponentTypes)[number];

export const sockets = ['AM5', 'AM4', 'LGA1851', 'LGA1700'] as const;
export type Socket = (typeof sockets)[number];

/** Семейства CPU — по ним плата объявляет поддержку и необходимость обновить BIOS. */
export const cpuFamilies = [
  'ryzen-5000',
  'ryzen-7000',
  'ryzen-8000',
  'ryzen-9000',
  'intel-12',
  'intel-13',
  'intel-14',
  'intel-ultra-200',
] as const;
export type CpuFamily = (typeof cpuFamilies)[number];

export const memoryTypes = ['DDR4', 'DDR5'] as const;
export type MemoryType = (typeof memoryTypes)[number];

export const motherboardFormFactors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'] as const;
export type MotherboardFormFactor = (typeof motherboardFormFactors)[number];

export const psuFormFactors = ['ATX', 'SFX', 'SFX-L'] as const;
export type PsuFormFactor = (typeof psuFormFactors)[number];

export const radiatorSizes = [120, 140, 240, 280, 360, 420] as const;
export type RadiatorSize = (typeof radiatorSizes)[number];

export const fanSizes = [120, 140, 160] as const;

export const pcieGenerations = [3, 4, 5] as const;
export type PcieGen = (typeof pcieGenerations)[number];

export const colors = ['black', 'white', 'silver', 'gray', 'red', 'pink'] as const;

export const gpuVendors = ['nvidia', 'amd', 'intel'] as const;

export const laptopPanels = ['IPS', 'OLED', 'Mini-LED'] as const;
export const laptopOs = ['windows', 'macos', 'none'] as const;
export const armMounts = ['clamp', 'grommet', 'clamp-grommet', 'wall'] as const;
export const chairMaterials = ['eco-leather', 'leather', 'fabric', 'mesh'] as const;
export const chairArmrests = ['2d', '3d', '4d'] as const;
export const deskHeights = ['fixed', 'manual', 'electric'] as const;
export type GpuVendor = (typeof gpuVendors)[number];
