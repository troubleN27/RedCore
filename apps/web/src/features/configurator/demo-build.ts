import type { BuildItem } from './types';

/**
 * Готовая сборка, которой открывается пустой конфигуратор. Детали подобраны так, чтобы у
 * каждой была скачанная 3D-модель (не процедурная), а сборка проходила проверку совместимости.
 */
export const demoBuild: BuildItem[] = [
  { slot: 'case', slug: 'lian-li-lancool-216-black', qty: 1 },
  { slot: 'motherboard', slug: 'asus-rog-strix-x870e-e-gaming-wifi', qty: 1 },
  { slot: 'cpu', slug: 'amd-ryzen-7-9800x3d', qty: 1 },
  { slot: 'cooler', slug: 'deepcool-ak620-digital', qty: 1 },
  { slot: 'ram', slug: 'g-skill-trident-z5-neo-rgb-32gb-2x16gb-ddr5-6000-cl30', qty: 1 },
  { slot: 'gpu', slug: 'msi-geforce-rtx-5070-ti-16g-gaming-trio-oc', qty: 1 },
  { slot: 'storage', slug: 'samsung-990-pro-2tb-m-2-nvme-pcie-4-0', qty: 1 },
  { slot: 'psu', slug: 'corsair-rm850e-atx3-1-850w-80-gold', qty: 1 },
  { slot: 'case_fan', slug: 'lian-li-uni-fan-sl-inf-120-argb-3-pack', qty: 1 },
];
