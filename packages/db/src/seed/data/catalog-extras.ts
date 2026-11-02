import { products, type SpecsInput } from './types';

// Пополнение существующих разделов. Отдельные списки идут в seedLists после основных,
// поэтому артикулы (SKU) уже заведённых товаров не сдвигаются.

type Ram = SpecsInput<'ram'>;
type Drive = SpecsInput<'storage'>;
const kit = (spec: Partial<Ram>): Ram =>
  ({ modules: 2, rgb: false, color: 'black', profile: 'xmp', ...spec }) as Ram;
const nvme = (spec: Partial<Drive>): Drive =>
  ({ kind: 'nvme', formFactor: 'm2-2280', heatsink: false, ...spec }) as Drive;

export const moreKeyboards = products('keyboard', [
  {
    brand: 'Razer',
    name: 'Huntsman V3 Pro TKL',
    usd: 250,
    specs: {
      formFactor: 'tkl',
      switchType: 'Razer Analog Optical Gen-2',
      connection: 'wired',
      rgb: true,
      hotSwap: false,
    },
  },
  {
    brand: 'SteelSeries',
    name: 'Apex 3 TKL',
    usd: 50,
    specs: {
      formFactor: 'tkl',
      switchType: 'Whisper-Quiet Membrane',
      connection: 'wired',
      rgb: true,
      hotSwap: false,
    },
  },
  {
    brand: 'Logitech',
    name: 'G715 Wireless',
    usd: 170,
    specs: {
      formFactor: 'tkl',
      switchType: 'GX Red Linear',
      connection: 'tri-mode',
      rgb: true,
      hotSwap: false,
    },
  },
  {
    brand: 'Keychron',
    name: 'Q1 Max',
    usd: 210,
    specs: {
      formFactor: '75',
      switchType: 'Gateron Jupiter Red',
      connection: 'tri-mode',
      rgb: true,
      hotSwap: true,
    },
  },
  {
    brand: 'Corsair',
    name: 'K70 RGB Pro',
    usd: 160,
    specs: {
      formFactor: 'full',
      switchType: 'Cherry MX Red',
      connection: 'wired',
      rgb: true,
      hotSwap: false,
    },
  },
  {
    brand: 'HyperX',
    name: 'Alloy Rise 75',
    usd: 150,
    specs: {
      formFactor: '75',
      switchType: 'HyperX Linear',
      connection: 'wired',
      rgb: true,
      hotSwap: true,
    },
  },
  {
    brand: 'Akko',
    name: '5075B Plus',
    usd: 90,
    specs: {
      formFactor: '75',
      switchType: 'Akko V3 Cream Yellow Pro',
      connection: 'tri-mode',
      rgb: true,
      hotSwap: true,
    },
  },
  {
    brand: 'Redragon',
    name: 'K617 Fizz',
    usd: 35,
    specs: {
      formFactor: '60',
      switchType: 'Redragon Red',
      connection: 'wired',
      rgb: true,
      hotSwap: true,
    },
  },
]);

export const moreMice = products('mouse', [
  {
    brand: 'Razer',
    name: 'DeathAdder V3 HyperSpeed',
    usd: 100,
    specs: {
      sensor: 'Focus X 26K',
      maxDpi: 26000,
      weightG: 55,
      connection: 'wireless',
      buttons: 6,
      rgb: false,
    },
  },
  {
    brand: 'Logitech',
    name: 'G305 Lightspeed',
    usd: 40,
    specs: {
      sensor: 'HERO',
      maxDpi: 12000,
      weightG: 99,
      connection: 'wireless',
      buttons: 6,
      rgb: false,
    },
  },
  {
    brand: 'Logitech',
    name: 'G Pro 2 Lightspeed',
    usd: 140,
    specs: {
      sensor: 'HERO 2',
      maxDpi: 32000,
      weightG: 80,
      connection: 'wireless',
      buttons: 8,
      rgb: true,
    },
  },
  {
    brand: 'SteelSeries',
    name: 'Rival 3',
    usd: 30,
    specs: {
      sensor: 'TrueMove Core',
      maxDpi: 8500,
      weightG: 77,
      connection: 'wired',
      buttons: 6,
      rgb: true,
    },
  },
  {
    brand: 'Zowie',
    name: 'FK2-DW',
    usd: 160,
    specs: {
      sensor: 'PAW3950',
      maxDpi: 30000,
      weightG: 63,
      connection: 'wireless',
      buttons: 5,
      rgb: false,
    },
  },
  {
    brand: 'Lamzu',
    name: 'Atlantis Mini 4K',
    usd: 110,
    specs: {
      sensor: 'PAW3395',
      maxDpi: 26000,
      weightG: 51,
      connection: 'wireless',
      buttons: 5,
      rgb: false,
    },
  },
  {
    brand: 'Glorious',
    name: 'Model O 2 Wireless',
    usd: 100,
    specs: {
      sensor: 'BAMF 2.0 26K',
      maxDpi: 26000,
      weightG: 68,
      connection: 'tri-mode',
      buttons: 6,
      rgb: true,
    },
  },
  {
    brand: 'ATK',
    name: 'Blazing Sky F1 Pro',
    usd: 60,
    specs: {
      sensor: 'PAW3950',
      maxDpi: 30000,
      weightG: 45,
      connection: 'wireless',
      buttons: 5,
      rgb: false,
    },
  },
]);

export const moreHeadsets = products('headset', [
  {
    brand: 'SteelSeries',
    name: 'Arctis Nova Pro Wireless',
    usd: 350,
    specs: { connection: 'wireless', driverMm: 40, microphone: true, surround: true, weightG: 337 },
  },
  {
    brand: 'HyperX',
    name: 'Cloud Alpha Wireless',
    usd: 200,
    specs: { connection: 'wireless', driverMm: 50, microphone: true, surround: true, weightG: 335 },
  },
  {
    brand: 'Logitech',
    name: 'G733 Lightspeed',
    usd: 130,
    specs: { connection: 'wireless', driverMm: 40, microphone: true, surround: true, weightG: 278 },
  },
  {
    brand: 'Corsair',
    name: 'Virtuoso RGB Wireless XT',
    usd: 270,
    specs: { connection: 'tri-mode', driverMm: 50, microphone: true, surround: true, weightG: 404 },
  },
  {
    brand: 'JBL',
    name: 'Quantum 610 Wireless',
    usd: 150,
    specs: { connection: 'wireless', driverMm: 50, microphone: true, surround: true, weightG: 346 },
  },
  {
    brand: 'EPOS',
    name: 'H6Pro Closed',
    usd: 160,
    specs: { connection: 'wired', driverMm: 42, microphone: true, surround: false, weightG: 326 },
  },
]);

export const moreMousepads = products('mousepad', [
  {
    brand: 'Razer',
    name: 'Strider XXL',
    usd: 50,
    specs: { widthMm: 940, heightMm: 410, thicknessMm: 3, surface: 'hybrid', rgb: false },
  },
  {
    brand: 'Logitech',
    name: 'G840 XL',
    usd: 50,
    specs: { widthMm: 900, heightMm: 400, thicknessMm: 3, surface: 'cloth', rgb: false },
  },
  {
    brand: 'Artisan',
    name: 'Hien XL Mid',
    usd: 60,
    specs: { widthMm: 490, heightMm: 420, thicknessMm: 4, surface: 'cloth', rgb: false },
  },
  {
    brand: 'Corsair',
    name: 'MM350 Pro Extended XL',
    usd: 35,
    specs: { widthMm: 930, heightMm: 400, thicknessMm: 4, surface: 'cloth', rgb: false },
  },
  {
    brand: 'ATK',
    name: 'Blaze XSoft',
    usd: 15,
    specs: { widthMm: 490, heightMm: 420, thicknessMm: 4, surface: 'cloth', rgb: false },
  },
]);

export const moreWebcams = products('webcam', [
  {
    brand: 'Logitech',
    name: 'C922 Pro Stream',
    usd: 90,
    specs: { resolution: '1080p', fps: 30, autofocus: true, microphone: true },
  },
  {
    brand: 'Logitech',
    name: 'StreamCam',
    usd: 150,
    specs: { resolution: '1080p', fps: 60, autofocus: true, microphone: true },
  },
  {
    brand: 'Logitech',
    name: 'MX Brio',
    usd: 200,
    specs: { resolution: '4k', fps: 30, autofocus: true, microphone: true },
  },
  {
    brand: 'Elgato',
    name: 'Facecam Pro',
    usd: 300,
    specs: { resolution: '4k', fps: 60, autofocus: true, microphone: false },
  },
  {
    brand: 'Razer',
    name: 'Kiyo X',
    usd: 80,
    specs: { resolution: '1080p', fps: 30, autofocus: true, microphone: false },
  },
  {
    brand: 'Insta360',
    name: 'Link 2',
    usd: 200,
    specs: { resolution: '4k', fps: 30, autofocus: true, microphone: true },
  },
  {
    brand: 'Anker',
    name: 'PowerConf C200',
    usd: 60,
    specs: { resolution: '1440p', fps: 30, autofocus: true, microphone: true },
  },
]);

export const moreCaseFans = products('case_fan', [
  {
    brand: 'be quiet!',
    name: 'Pure Wings 3 120mm PWM',
    usd: 10,
    specs: {
      sizeMm: 120,
      packCount: 1,
      maxRpm: 1600,
      airflowCfm: 40.2,
      noiseDb: 21.6,
      lighting: 'none',
      connector: '4pin',
      color: 'black',
    },
  },
  {
    brand: 'Noctua',
    name: 'NF-A14x25 G2 PWM',
    usd: 40,
    specs: {
      sizeMm: 140,
      packCount: 1,
      maxRpm: 1500,
      airflowCfm: 88.1,
      noiseDb: 24.6,
      lighting: 'none',
      connector: '4pin',
      color: 'black',
    },
  },
  {
    brand: 'Corsair',
    name: 'iCUE Link RX120 RGB 3-Pack',
    usd: 120,
    specs: {
      sizeMm: 120,
      packCount: 3,
      maxRpm: 2100,
      airflowCfm: 73.5,
      noiseDb: 33.5,
      lighting: 'argb',
      connector: '4pin',
      color: 'black',
    },
  },
  {
    brand: 'Phanteks',
    name: 'D30 120 DRGB 3-Pack',
    usd: 90,
    specs: {
      sizeMm: 120,
      packCount: 3,
      maxRpm: 2000,
      airflowCfm: 64.4,
      noiseDb: 34,
      lighting: 'argb',
      connector: '4pin',
      color: 'black',
    },
  },
]);

export const moreMemory = products('ram', [
  {
    brand: 'Kingston',
    name: 'Fury Beast RGB 32GB (2×16GB) DDR5-6000 CL30',
    usd: 200,
    specs: kit({
      type: 'DDR5',
      capacityGb: 32,
      speedMts: 6000,
      casLatency: 30,
      heightMm: 42,
      rgb: true,
      profile: 'xmp-expo',
    }),
  },
  {
    brand: 'Corsair',
    name: 'Vengeance 32GB (2×16GB) DDR5-6000 CL36',
    usd: 175,
    specs: kit({ type: 'DDR5', capacityGb: 32, speedMts: 6000, casLatency: 36, heightMm: 35 }),
  },
  {
    brand: 'G.Skill',
    name: 'Trident Z5 RGB White 64GB (2×32GB) DDR5-6400 CL32',
    usd: 380,
    specs: kit({
      type: 'DDR5',
      capacityGb: 64,
      speedMts: 6400,
      casLatency: 32,
      heightMm: 44,
      rgb: true,
      color: 'white',
    }),
  },
  {
    brand: 'TeamGroup',
    name: 'T-Force Vulcan 32GB (2×16GB) DDR4-3600 CL18',
    usd: 90,
    specs: kit({ type: 'DDR4', capacityGb: 32, speedMts: 3600, casLatency: 18, heightMm: 33 }),
  },
]);

export const moreStorage = products('storage', [
  {
    brand: 'Samsung',
    name: '990 EVO Plus 1TB M.2 NVMe',
    usd: 85,
    specs: nvme({ interface: 'pcie4', capacityGb: 1000, readMbs: 7150, writeMbs: 6300, tbw: 600 }),
  },
  {
    brand: 'Kingston',
    name: 'Fury Renegade 2TB M.2 NVMe PCIe 4.0',
    usd: 170,
    specs: nvme({ interface: 'pcie4', capacityGb: 2000, readMbs: 7300, writeMbs: 7000, tbw: 2000 }),
  },
  {
    brand: 'Crucial',
    name: 'P310 2TB M.2 NVMe PCIe 4.0',
    usd: 125,
    specs: nvme({ interface: 'pcie4', capacityGb: 2000, readMbs: 7100, writeMbs: 6000, tbw: 440 }),
  },
  {
    brand: 'WD',
    name: 'Black SN8100 2TB M.2 NVMe PCIe 5.0',
    usd: 260,
    specs: nvme({
      interface: 'pcie5',
      capacityGb: 2000,
      readMbs: 14900,
      writeMbs: 14000,
      tbw: 1200,
    }),
  },
]);
