import { describe, expect, it } from 'vitest';
import { cpu, hdd, motherboard, storage } from '../test/fixtures';
import { componentTypes } from './enums';
import { isComponentType, parseSpecs, safeParseSpecs, specSchemas } from './schemas';

describe('схемы характеристик', () => {
  it('есть схема для каждого типа товара', () => {
    expect(Object.keys(specSchemas).sort()).toEqual([...componentTypes].sort());
  });

  it('подставляет значения по умолчанию', () => {
    expect(motherboard().specs.biosUpdateRequiredFor).toEqual([]);
  });

  it('отклоняет потоков меньше, чем ядер', () => {
    expect(() => cpu({ cores: 16, threads: 8 })).toThrow();
  });

  it('отклоняет пиковую мощность ниже TDP', () => {
    expect(() => cpu({ tdpW: 125, maxPowerW: 65 })).toThrow();
  });

  it('NVMe обязан быть M.2 PCIe, SATA SSD/HDD — 2,5″/3,5″', () => {
    expect(() => storage({ formFactor: '2.5' })).toThrow();
    expect(() => storage({ kind: 'sata-ssd', interface: 'pcie4' })).toThrow();
    expect(hdd().specs.rpm).toBe(7200);
  });

  it('HDD без оборотов — ошибка', () => {
    const result = safeParseSpecs('storage', {
      kind: 'hdd',
      formFactor: '3.5',
      interface: 'sata',
      capacityGb: 2000,
      readMbs: 200,
      writeMbs: 200,
      heatsink: false,
    });
    expect(result.success).toBe(false);
  });

  it('объём памяти делится на число модулей', () => {
    expect(
      safeParseSpecs('ram', {
        type: 'DDR5',
        capacityGb: 48,
        modules: 2,
        speedMts: 6000,
        casLatency: 30,
        heightMm: 35,
        rgb: false,
        color: 'black',
        profile: 'xmp',
      }).success,
    ).toBe(true);
    expect(
      safeParseSpecs('ram', {
        type: 'DDR5',
        capacityGb: 33,
        modules: 2,
        speedMts: 6000,
        casLatency: 30,
        heightMm: 35,
        rgb: false,
        color: 'black',
        profile: 'xmp',
      }).success,
    ).toBe(false);
  });

  it('кулер различается по виду', () => {
    expect(() =>
      parseSpecs('cooler', {
        kind: 'aio',
        sockets: ['AM5'],
        tdpRatingW: 300,
        fans: 3,
        fanSizeMm: 120,
        rgb: false,
        color: 'black',
        radiatorMm: 360,
        radiatorThicknessMm: 27,
        pumpDisplay: false,
      }),
    ).not.toThrow();
    expect(() =>
      parseSpecs('cooler', {
        kind: 'aio',
        sockets: ['AM5'],
        tdpRatingW: 300,
        fans: 3,
        fanSizeMm: 120,
        rgb: false,
        color: 'black',
        radiatorMm: 300,
        radiatorThicknessMm: 27,
        pumpDisplay: false,
      }),
    ).toThrow();
  });

  it('isComponentType', () => {
    expect(isComponentType('gpu')).toBe(true);
    expect(isComponentType('laptop')).toBe(false);
  });
});

describe('specKeyOrder', () => {
  it('порядок ключей как в схеме, включая варианты кулеров', async () => {
    const { specKeyOrder } = await import('./schemas');
    expect(specKeyOrder('cpu').slice(0, 3)).toEqual(['socket', 'family', 'cores']);
    expect(specKeyOrder('cooler')).toEqual(
      expect.arrayContaining(['kind', 'heightMm', 'radiatorMm']),
    );
  });
});
