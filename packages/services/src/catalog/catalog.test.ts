import type { Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getCompatibleProducts,
  getFeaturedProducts,
  getPrebuilts,
  getProductDetail,
} from './products';
import { listCategoryPage, parseCatalogQuery, serializeCatalogQuery } from './query';
import { searchCatalog } from './search';
import { getCatalogSnapshot, getPerfIndex, invalidateCatalogCache } from './snapshot';
import type { CatalogSnapshot } from './types';

let testDb: TestDatabase;
let db: Database;
let ru: CatalogSnapshot;
let uz: CatalogSnapshot;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  invalidateCatalogCache();
  [ru, uz] = await Promise.all([getCatalogSnapshot(db, 'ru'), getCatalogSnapshot(db, 'uz')]);
});

afterAll(async () => {
  await testDb.close();
});

describe('снимок каталога', () => {
  it('категории с переводами и счётчиками', () => {
    expect(ru.categories).toHaveLength(16);
    const gpu = ru.categories.find((c) => c.slug === 'gpu')!;
    expect(gpu.name).toBe('Видеокарты');
    expect(uz.categories.find((c) => c.slug === 'gpu')!.name).toBe('Videokartalar');
    expect(gpu.productCount).toBe(24);
    expect(gpu.inStockCount).toBe(23);
    expect(gpu.minPriceUzs).toBeGreaterThan(0);
  });

  it('описания на языке снимка', () => {
    const cpu = ru.bySlug.get('amd-ryzen-7-9800x3d')!;
    expect(cpu.shortDescription).toContain('ядер');
    expect(uz.bySlug.get('amd-ryzen-7-9800x3d')!.shortDescription).toContain('yadro');
  });

  it('кэшируется', async () => {
    expect(await getCatalogSnapshot(db, 'ru')).toBe(ru);
  });
});

describe('страница категории', () => {
  it('фильтр по сокету', () => {
    const page = listCategoryPage(ru, 'cpu', { socket: 'AM5' })!;
    expect(page.total).toBe(11);
    expect(page.items.every((p) => (p.specs as { socket: string }).socket === 'AM5')).toBe(true);
  });

  it('несколько значений и диапазон вместе', () => {
    const page = listCategoryPage(ru, 'cpu', { socket: 'AM5,AM4', tdpW: '60-90' })!;
    expect(page.total).toBeGreaterThan(0);
    for (const p of page.items) {
      const specs = p.specs as { socket: string; tdpW: number };
      expect(['AM5', 'AM4']).toContain(specs.socket);
      expect(specs.tdpW).toBeGreaterThanOrEqual(60);
      expect(specs.tdpW).toBeLessThanOrEqual(90);
    }
  });

  it('длина видеокарты до 300 мм — для компактных корпусов', () => {
    const page = listCategoryPage(ru, 'gpu', { lengthMm: '-300' })!;
    expect(page.items.every((p) => (p.specs as { lengthMm: number }).lengthMm <= 300)).toBe(true);
  });

  it('фасеты дизъюнктивны: выбор сокета не обнуляет счётчики других сокетов', () => {
    const page = listCategoryPage(ru, 'cpu', { socket: 'AM5' })!;
    const socket = page.facets.find((f) => f.key === 'socket')!;
    expect(socket.values!.find((v) => v.value === 'LGA1700')!.count).toBe(6);
    const cores = page.facets.find((f) => f.key === 'cores')!;
    expect(cores.min).toBe(4);
  });

  it('фасеты сужаются другими фильтрами', () => {
    const page = listCategoryPage(ru, 'motherboards', { socket: 'AM4' })!;
    const memory = page.facets.find((f) => f.key === 'memoryType')!;
    expect(memory.values!.find((v) => v.value === 'DDR5')!.count).toBe(0);
  });

  it('только в наличии', () => {
    const all = listCategoryPage(ru, 'gpu', {})!;
    const inStock = listCategoryPage(ru, 'gpu', { stock: '1' })!;
    expect(inStock.total).toBe(all.total - 1);
  });

  it('сортировка по цене', () => {
    const prices = listCategoryPage(ru, 'gpu', { sort: 'price-asc', stock: '1' })!.items.map(
      (p) => p.priceUzs,
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('пагинация с ограничением номера страницы', () => {
    const page = listCategoryPage(ru, 'gpu', { page: '99' }, 10)!;
    expect(page.pageCount).toBe(3);
    expect(page.page).toBe(3);
    expect(page.items).toHaveLength(4);
  });

  it('неизвестная категория — null', () => {
    expect(listCategoryPage(ru, 'laptops', {})).toBeNull();
  });

  it('URL ⇄ состояние фильтров', () => {
    const definitions = ru.filters.get('cpu')!;
    const query = parseCatalogQuery(
      new URLSearchParams(
        'socket=AM5,AM4&tdpW=65-&integratedGraphics=1&sort=price-asc&page=2&stock=1&unknown=x',
      ),
      definitions,
    );
    expect(query).toEqual({
      filters: { socket: ['AM5', 'AM4'], tdpW: { min: 65 }, integratedGraphics: true },
      sort: 'price-asc',
      page: 2,
      inStockOnly: true,
    });
    expect(serializeCatalogQuery(query).toString()).toBe(
      'socket=AM5%2CAM4&tdpW=65-&integratedGraphics=1&stock=1&sort=price-asc&page=2',
    );
  });

  it('мусорные значения игнорируются', () => {
    const query = parseCatalogQuery(
      { tdpW: 'abc-xyz', sort: 'evil', page: '-5' },
      ru.filters.get('cpu')!,
    );
    expect(query).toEqual({ filters: {}, sort: 'popular', page: 1, inStockOnly: false });
  });
});

describe('поиск', () => {
  it('находит модель с пробелом и слитно', () => {
    const spaced = searchCatalog(ru, 'rtx 5070');
    const compact = searchCatalog(ru, 'rtx5070');
    expect(spaced.total).toBeGreaterThan(0);
    expect(compact.items.map((p) => p.slug)).toEqual(
      expect.arrayContaining(spaced.items.slice(0, 3).map((p) => p.slug)),
    );
    expect(spaced.items[0]!.componentType).toBe('gpu');
  });

  it('синоним категории сужает тип: «видюха 5070»', () => {
    const result = searchCatalog(ru, 'видюха 5070');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.componentType === 'gpu')).toBe(true);
    expect(result.categories.map((c) => c.slug)).toEqual(['gpu']);
  });

  it('узбекский запрос с разными апострофами', () => {
    const a = searchCatalog(uz, 'ona plata am5');
    expect(a.items.length).toBeGreaterThan(0);
    expect(a.items.every((p) => p.componentType === 'motherboard')).toBe(true);
    expect(searchCatalog(uz, 'sovutish').total).toBe(searchCatalog(uz, 'sovutish').total);
  });

  it('ищет по характеристикам: «ddr5 6000»', () => {
    const result = searchCatalog(ru, 'ddr5 6000');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.componentType === 'ram')).toBe(true);
  });

  it('по артикулу', () => {
    const sku = ru.bySlug.get('amd-ryzen-7-9800x3d')!.sku;
    expect(searchCatalog(ru, sku).items[0]!.slug).toBe('amd-ryzen-7-9800x3d');
  });

  it('пустой запрос и бессмыслица', () => {
    expect(searchCatalog(ru, '   ').total).toBe(0);
    expect(searchCatalog(ru, 'qwertyzxcv').total).toBe(0);
  });

  it('товары в наличии выше', () => {
    const items = searchCatalog(ru, 'rtx 5090').items;
    expect(items[0]!.available).toBeGreaterThan(0);
  });
});

describe('товар', () => {
  it('карточка готовой сборки содержит компоненты', async () => {
    const detail = (await getProductDetail(db, ru, 'redcore-ultra'))!;
    expect(detail.components).toHaveLength(8);
    expect(detail.category.name).toBe('Готовые ПК');
  });

  it('неизвестный slug — null', async () => {
    expect(await getProductDetail(db, ru, 'nope')).toBeNull();
  });

  it('«совместимо с этим» для CPU AM5 — только AM5-платы, DDR5 и кулеры с поддержкой сокета', async () => {
    const perf = await getPerfIndex(db);
    const groups = getCompatibleProducts(ru, perf, ru.bySlug.get('amd-ryzen-7-9800x3d')!);
    const boards = groups.find((g) => g.componentType === 'motherboard')!;
    expect(boards.items.every((p) => (p.specs as { socket: string }).socket === 'AM5')).toBe(true);
    const memory = groups.find((g) => g.componentType === 'ram')!;
    expect(memory.items.every((p) => (p.specs as { type: string }).type === 'DDR5')).toBe(true);
    const coolers = groups.find((g) => g.componentType === 'cooler')!;
    expect(
      coolers.items.every((p) => (p.specs as { sockets: string[] }).sockets.includes('AM5')),
    ).toBe(true);
  });

  it('для длинной видеокарты не предлагает тесные корпуса', async () => {
    const perf = await getPerfIndex(db);
    const groups = getCompatibleProducts(
      ru,
      perf,
      ru.bySlug.get('asus-rog-astral-geforce-rtx-5090-oc-32gb')!,
    );
    const cases = groups.find((g) => g.componentType === 'case')!;
    expect(
      cases.items.every((p) => (p.specs as { maxGpuLengthMm: number }).maxGpuLengthMm >= 357),
    ).toBe(true);
  });

  it('периферия без «совместимо с этим»', async () => {
    const perf = await getPerfIndex(db);
    expect(
      getCompatibleProducts(ru, perf, ru.bySlug.get('logitech-g-pro-x-superlight-2')!),
    ).toEqual([]);
  });

  it('подборки для главной', () => {
    expect(getFeaturedProducts(ru).length).toBeGreaterThan(4);
    const prebuilts = getPrebuilts(ru);
    expect(prebuilts).toHaveLength(8);
    expect(prebuilts[0]!.priceUzs).toBeLessThan(prebuilts.at(-1)!.priceUzs);
  });
});
