import type { CatalogSnapshot, ProductSummary } from '@redcore/services/types';

/** «Хиты продаж» на главной — в этом порядке; снятые с продажи товары пропускаются */
const BESTSELLERS = [
  'msi-geforce-rtx-5070-ti-16g-gaming-trio-oc',
  'wooting-60he',
  'logitech-g-pro-x-superlight-2',
  'samsung-990-pro-2tb-m-2-nvme-pcie-4-0',
  'kingston-fury-beast-32gb-2x16gb-ddr5-6000-cl36',
  'asus-tuf-gaming-vg27aq5a-27-qhd-210-hz',
  'asus-tuf-gaming-b850-plus-wifi',
  'asus-vivobook-16-x1605va',
];

export function getBestsellers(snapshot: CatalogSnapshot): ProductSummary[] {
  return BESTSELLERS.map((slug) => snapshot.bySlug.get(slug)).filter(
    (p): p is ProductSummary => p !== undefined,
  );
}
