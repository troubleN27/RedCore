import type { SpecsInput } from './types';

export interface PrebuiltSeed {
  name: string;
  specs: SpecsInput<'prebuilt'>;
  /** Компоненты — «Бренд Модель» в точности как в каталоге */
  components: string[];
  featured?: boolean;
}

// Готовые сборки из реальных товаров каталога. При seed каждая проходит checkBuild без ошибок.
export const prebuilts: PrebuiltSeed[] = [
  {
    name: 'Start',
    specs: { purpose: 'gaming', targetResolution: '1080p' },
    components: [
      'AMD Ryzen 5 5600',
      'ASRock B550M Pro4',
      'Kingston Fury Beast 16GB (2×8GB) DDR4-3200 CL16',
      'Gigabyte GeForce RTX 5060 Windforce OC 8G',
      'Kingston NV3 1TB M.2 NVMe PCIe 4.0',
      'DeepCool PK550D 550W 80+ Bronze',
      'Zalman i3 Neo Black',
    ],
  },
  {
    name: 'Esports',
    specs: { purpose: 'esports', targetResolution: '1080p' },
    components: [
      'AMD Ryzen 5 7500F',
      'ASRock B650M Pro RS WiFi',
      'Kingston Fury Beast 32GB (2×16GB) DDR5-6000 CL36',
      'Sapphire Pulse Radeon RX 9060 XT 16GB',
      'Kingston NV3 1TB M.2 NVMe PCIe 4.0',
      'DeepCool AK400',
      'Cooler Master MWE Gold 650 V3 ATX3.1',
      'Fractal Design Pop Air RGB Black',
    ],
  },
  {
    name: 'Pro',
    specs: { purpose: 'gaming', targetResolution: '1440p' },
    featured: true,
    components: [
      'AMD Ryzen 7 9700X',
      'MSI MAG B850 Tomahawk Max WiFi',
      'Kingston Fury Beast 32GB (2×16GB) DDR5-6000 CL36',
      'Gigabyte GeForce RTX 5070 Windforce OC SFF 12G',
      'Samsung 990 Pro 1TB M.2 NVMe PCIe 4.0',
      'Thermalright Peerless Assassin 120 SE',
      'Corsair RM750e ATX3.1 750W 80+ Gold',
      'NZXT H5 Flow (2024) Black',
    ],
  },
  {
    name: 'Ultra',
    specs: { purpose: 'gaming', targetResolution: '1440p' },
    featured: true,
    components: [
      'AMD Ryzen 7 9800X3D',
      'ASUS TUF Gaming B850-Plus WiFi',
      'G.Skill Flare X5 32GB (2×16GB) DDR5-6000 CL30',
      'MSI GeForce RTX 5070 Ti 16G Gaming Trio OC',
      'Samsung 990 Pro 2TB M.2 NVMe PCIe 4.0',
      'Arctic Liquid Freezer III Pro 360',
      'Corsair RM850e ATX3.1 850W 80+ Gold',
      'Lian Li Lancool 216 Black',
    ],
  },
  {
    name: 'Extreme',
    specs: { purpose: 'gaming', targetResolution: '2160p' },
    components: [
      'AMD Ryzen 9 9950X3D',
      'ASUS ROG Strix X870E-E Gaming WiFi',
      'Corsair Dominator Titanium RGB 64GB (2×32GB) DDR5-6600 CL32',
      'ASUS ROG Astral GeForce RTX 5090 OC 32GB',
      'Crucial T705 2TB Heatsink M.2 NVMe PCIe 5.0',
      'Corsair iCUE Link H150i RGB',
      'Seasonic Vertex PX-1200 1200W 80+ Platinum',
      'Lian Li O11 Dynamic EVO Black',
    ],
  },
  {
    name: 'White Edition',
    specs: { purpose: 'gaming', targetResolution: '1440p' },
    components: [
      'AMD Ryzen 7 7800X3D',
      'ASRock B650M Pro RS WiFi',
      'TeamGroup T-Force Delta RGB White 32GB (2×16GB) DDR5-6400 CL32',
      'Palit GeForce RTX 5070 Ti GamingPro White OC 16GB',
      'Samsung 990 EVO Plus 2TB M.2 NVMe',
      'NZXT Kraken Elite 360 RGB White',
      'Corsair RM850e ATX3.1 850W 80+ Gold',
      'NZXT H6 Flow White',
    ],
  },
  {
    name: 'Creator',
    specs: { purpose: 'workstation', targetResolution: '2160p' },
    components: [
      'Intel Core Ultra 9 285K',
      'ASUS TUF Gaming Z890-Plus WiFi',
      'Kingston Fury Beast 64GB (2×32GB) DDR5-6000 CL36',
      'MSI GeForce RTX 5080 16G Ventus 3X OC',
      'Lexar NM790 4TB M.2 NVMe PCIe 4.0',
      'be quiet! Dark Rock Pro 5',
      'Corsair RM1000x Shift 1000W 80+ Gold',
      'Fractal Design North Charcoal Black',
    ],
  },
  {
    name: 'Mini ITX',
    specs: { purpose: 'sff', targetResolution: '1440p' },
    components: [
      'AMD Ryzen 7 9700X',
      'ASUS ROG Strix B850-I Gaming WiFi',
      'G.Skill Flare X5 32GB (2×16GB) DDR5-6000 CL30',
      'Zotac Gaming GeForce RTX 5070 Twin Edge OC',
      'Samsung 990 Pro 1TB M.2 NVMe PCIe 4.0',
      'Noctua NH-L9a-AM5',
      'Corsair SF750 SFX 750W 80+ Platinum',
      'Cooler Master MasterBox NR200P V2 Black',
    ],
  },
];
