import { checkBuild, componentTypes, solveBuild, type BuildPurpose } from '@redcore/domain';
import { describe, expect, it } from 'vitest';
import { buildSeedCatalog } from './catalog';
import { categories } from './data/categories';
import { DEFAULT_USD_UZS_RATE, usdToUzs } from './pricing';

const { products, perf } = buildSeedCatalog(DEFAULT_USD_UZS_RATE);
const cyrillic = /[Ѐ-ӿ]/;
const byType = (type: string) => products.filter((p) => p.componentType === type);

describe('демо-каталог', () => {
  it('не меньше 180 товаров', () => {
    expect(products.length).toBeGreaterThanOrEqual(180);
  });

  it('товары есть в каждой категории', () => {
    for (const type of componentTypes) expect(byType(type).length, type).toBeGreaterThan(0);
    expect(categories.map((c) => c.type).sort()).toEqual([...componentTypes].sort());
  });

  it('slug и артикулы уникальны', () => {
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.sku)).size).toBe(products.length);
  });

  it('названия без кириллицы — они общие для RU и UZ', () => {
    expect(products.filter((p) => cyrillic.test(p.name)).map((p) => p.name)).toEqual([]);
  });

  it('у каждого товара есть описания на обоих языках, узбекское — латиницей', () => {
    for (const product of products) {
      expect(product.shortDescription.ru.length, product.slug).toBeGreaterThan(10);
      expect(product.shortDescription.uz.length, product.slug).toBeGreaterThan(10);
      expect(cyrillic.test(product.shortDescription.uz), product.slug).toBe(false);
    }
  });

  it('цены в сумах кратны 10 000 и правдоподобны', () => {
    for (const product of products) {
      expect(product.priceUzs % 10_000, product.slug).toBe(0);
      expect(product.priceUzs, product.slug).toBeGreaterThanOrEqual(200_000);
      expect(product.priceUzs, product.slug).toBeLessThan(150_000_000);
    }
    expect(usdToUzs(470, DEFAULT_USD_UZS_RATE)).toBe(6_420_000);
  });

  it('у каждой видеокарты и процессора есть индекс производительности', () => {
    for (const gpu of byType('gpu')) expect(perf.gpu[gpu.perfKey!], gpu.slug).toBeDefined();
    for (const cpu of byType('cpu')) expect(perf.cpu[cpu.perfKey!], cpu.slug).toBeDefined();
  });

  it('есть товары не в наличии для демонстрации', () => {
    expect(products.some((p) => p.stockQty === 0)).toBe(true);
  });
});

describe('готовые сборки', () => {
  const prebuilt = byType('prebuilt');

  it('8 сборок, каждая из существующих товаров', () => {
    expect(prebuilt).toHaveLength(8);
    const slugs = new Set(products.map((p) => p.slug));
    for (const pc of prebuilt) for (const c of pc.components!) expect(slugs.has(c.slug)).toBe(true);
  });

  it('дешевле суммы компонентов плюс сборка, но не дешевле самих компонентов на 10%', () => {
    for (const pc of prebuilt) {
      const sum = pc.components!.reduce(
        (acc, c) => acc + products.find((p) => p.slug === c.slug)!.priceUzs,
        0,
      );
      expect(pc.priceUzs).toBeLessThan(sum + 350_000);
      expect(pc.priceUzs).toBeGreaterThan(sum * 0.9);
    }
  });
});

describe('подборщик на реальном каталоге', () => {
  const cases: [BuildPurpose, number][] = [
    ['gaming', 10_000_000],
    ['gaming', 15_000_000],
    ['gaming', 20_000_000],
    ['gaming', 30_000_000],
    ['gaming', 60_000_000],
    ['esports', 12_000_000],
    ['office', 8_000_000],
    ['workstation', 40_000_000],
  ];

  it.each(cases)('%s за %i сум — полная совместимая сборка в бюджет', (purpose, budgetUzs) => {
    const result = solveBuild(products, perf, { budgetUzs, purpose });
    expect(result, `${purpose} ${budgetUzs}`).not.toBeNull();
    const check = checkBuild(result!.build, perf);
    expect(check.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(check.missing).toEqual([]);
    expect(result!.totalUzs).toBeLessThanOrEqual(budgetUzs);
    // Только товары в наличии
    for (const part of [
      result!.build.cpu,
      result!.build.gpu,
      result!.build.motherboard,
      result!.build.psu,
      result!.build.case,
    ]) {
      if (part) expect(part.stockQty).toBeGreaterThan(0);
    }
  });

  it('больше бюджет — видеокарта не слабее', () => {
    const at = (budgetUzs: number) => solveBuild(products, perf, { budgetUzs, purpose: 'gaming' })!;
    const index = (budget: number) => perf.gpu[at(budget).build.gpu!.specs.chip]!.index1440;
    expect(index(30_000_000)).toBeGreaterThanOrEqual(index(15_000_000));
    expect(index(60_000_000)).toBeGreaterThanOrEqual(index(30_000_000));
  });

  it('белая сборка предпочитает белый корпус', () => {
    const result = solveBuild(products, perf, {
      budgetUzs: 25_000_000,
      purpose: 'gaming',
      preferences: { color: 'white' },
    })!;
    expect(result.build.case?.specs.color).toBe('white');
  });

  it('ITX-сборка — плата и корпус малого формата', () => {
    const result = solveBuild(products, perf, {
      budgetUzs: 30_000_000,
      purpose: 'gaming',
      preferences: { formFactor: 'itx' },
    })!;
    expect(result.build.motherboard?.specs.formFactor).toBe('Mini-ITX');
    expect(result.build.case?.specs.formFactor).toBe('sff');
  });
});
