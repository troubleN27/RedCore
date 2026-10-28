import { describe, expect, it } from 'vitest';
import type { AnyCatalogProduct } from './catalog';
import { solveBuild, solveBuildVariants } from './solver';
import { airCooler, cpu, gpu, motherboard, pcCase, perf, psu, ram, storage } from './test/fixtures';

const p = (priceUzs: number, extra: { perfKey?: string; stockQty?: number } = {}) => ({
  priceUzs,
  ...extra,
});

const catalog: AnyCatalogProduct[] = [
  cpu({ integratedGraphics: true }, p(2_000_000, { perfKey: 'cpu-weak' })),
  cpu({}, p(3_500_000, { perfKey: 'cpu-mid' })),
  cpu({ tdpW: 120, maxPowerW: 162 }, p(6_000_000, { perfKey: 'cpu-top' })),
  gpu({ chip: 'rtx-5060', vramGb: 8, tbpW: 145, recommendedPsuW: 550 }, p(4_000_000)),
  gpu({}, p(7_000_000)),
  gpu(
    { chip: 'rtx-5090', tbpW: 575, recommendedPsuW: 1000, lengthMm: 357, slotWidth: 3.5 },
    p(30_000_000),
  ),
  motherboard({}, p(2_500_000)),
  motherboard({ formFactor: 'Mini-ITX', memorySlots: 2, maxMemoryGb: 96 }, p(4_000_000)),
  ram({ capacityGb: 16 }, p(900_000)),
  ram({}, p(1_700_000)),
  ram({ capacityGb: 64 }, p(3_600_000)),
  storage({ capacityGb: 1000 }, p(900_000)),
  storage({ capacityGb: 2000 }, p(1_600_000)),
  airCooler({ tdpRatingW: 150 }, p(300_000)),
  airCooler({ tdpRatingW: 250 }, p(600_000)),
  pcCase({}, p(1_000_000)),
  pcCase({ color: 'white' }, p(1_200_000)),
  psu({ wattage: 650 }, p(900_000)),
  psu({ wattage: 850 }, p(1_300_000)),
  psu({ wattage: 1200 }, p(2_500_000)),
];

describe('solveBuild', () => {
  it('собирает совместимую игровую сборку в бюджет', () => {
    const result = solveBuild(catalog, perf, { budgetUzs: 20_000_000, purpose: 'gaming' });
    expect(result).not.toBeNull();
    expect(result!.check.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result!.check.missing).toEqual([]);
    expect(result!.totalUzs).toBeLessThanOrEqual(20_000_000);
    expect(result!.build.gpu?.specs.chip).toBe('rtx-5070');
  });

  it('с бо́льшим бюджетом берёт видеокарту не слабее', () => {
    const small = solveBuild(catalog, perf, { budgetUzs: 15_000_000, purpose: 'gaming' })!;
    const big = solveBuild(catalog, perf, { budgetUzs: 20_000_000, purpose: 'gaming' })!;
    expect(small.build.gpu?.specs.chip).toBe('rtx-5060');
    expect(big.build.gpu?.specs.chip).toBe('rtx-5070');
  });

  it('детерминирован', () => {
    const a = solveBuild(catalog, perf, { budgetUzs: 20_000_000, purpose: 'gaming' });
    const b = solveBuild(catalog, perf, { budgetUzs: 20_000_000, purpose: 'gaming' });
    expect(a?.totalUzs).toBe(b?.totalUzs);
    expect(a?.build.cpu?.id).toBe(b?.build.cpu?.id);
  });

  it('офис: без видеокарты, CPU с iGPU', () => {
    const result = solveBuild(catalog, perf, { budgetUzs: 10_000_000, purpose: 'office' })!;
    expect(result.build.gpu).toBeUndefined();
    expect(result.build.cpu?.specs.integratedGraphics).toBe(true);
  });

  it('работа: больше памяти и сильный многопоток', () => {
    const result = solveBuild(catalog, perf, { budgetUzs: 25_000_000, purpose: 'workstation' })!;
    expect(result.build.ram[0]?.product.specs.capacityGb).toBe(64);
    expect(result.build.cpu?.perfKey).toBe('cpu-top');
  });

  it('учитывает цвет корпуса', () => {
    const result = solveBuild(catalog, perf, {
      budgetUzs: 20_000_000,
      purpose: 'gaming',
      preferences: { color: 'white' },
    })!;
    expect(result.build.case?.specs.color).toBe('white');
  });

  it('нереальный бюджет — null', () => {
    expect(solveBuild(catalog, perf, { budgetUzs: 3_000_000, purpose: 'gaming' })).toBeNull();
  });

  it('пропускает товары без остатка', () => {
    const outOfStock = catalog.map((item) =>
      item.componentType === 'psu' ? { ...item, stockQty: 0 } : item,
    );
    expect(solveBuild(outOfStock, perf, { budgetUzs: 20_000_000, purpose: 'gaming' })).toBeNull();
  });
});

describe('solveBuildVariants', () => {
  it('дешевле ≤ в бюджет ≤ мощнее', () => {
    const variants = solveBuildVariants(catalog, perf, {
      budgetUzs: 20_000_000,
      purpose: 'gaming',
    });
    expect(variants.cheaper!.totalUzs).toBeLessThanOrEqual(variants.balanced!.totalUzs);
    expect(variants.balanced!.totalUzs).toBeLessThanOrEqual(25_000_000);
  });
});
