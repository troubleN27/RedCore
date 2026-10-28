import { describe, expect, it } from 'vitest';
import { emptyBuild } from './catalog';
import { computePower, motherboardPowerW, roundUpToStep } from './power';
import { aio, caseFan, completeBuild, gpu, hdd, psu, ram, withPart } from './test/fixtures';

describe('computePower', () => {
  it('складывает нагрузку базовой сборки', () => {
    const report = computePower(completeBuild());
    // CPU 88 + GPU 250 + B850 50 + 2×DDR5 10 + NVMe 7 + кулер 2×3 + корпус 3×3 + периферия 15
    expect(report.breakdown).toEqual({
      cpu: 88,
      gpu: 250,
      motherboard: 50,
      memory: 10,
      storage: 7,
      cooling: 15,
      peripherals: 15,
    });
    expect(report.loadW).toBe(435);
  });

  it('рекомендация не ниже рекомендации вендора видеокарты', () => {
    expect(computePower(completeBuild()).recommendedPsuW).toBe(650);
  });

  it('для мощной системы — нагрузка с запасом 25%', () => {
    const build = withPart(completeBuild(), gpu({ tbpW: 575, recommendedPsuW: 700 }));
    const report = computePower(build);
    expect(report.recommendedPsuW).toBe(roundUpToStep(report.loadW * 1.25));
    expect(report.recommendedPsuW).toBeGreaterThan(700);
  });

  it('считает нагрузку на выбранный блок в процентах', () => {
    const report = computePower(withPart(completeBuild(), psu({ wattage: 870 })));
    expect(report.psuW).toBe(870);
    expect(report.loadPercent).toBe(50);
  });

  it('учитывает помпу СЖО, вентиляторы, HDD и RGB', () => {
    let build = withPart(completeBuild(), aio({ fans: 3, rgb: true }));
    build = withPart(build, caseFan({ packCount: 3, lighting: 'argb' }));
    build = withPart(build, hdd());
    build = withPart(build, ram({ rgb: true }));
    const report = computePower(build);
    expect(report.breakdown.cooling).toBe(3 * 3 + 6 + 3 * 3 + 9);
    // NVMe из базовой сборки + HDD
    expect(report.breakdown.storage).toBe(7 + 9);
    // RGB: СЖО + 3 вентилятора + память
    expect(report.breakdown.peripherals).toBe(15 + 5 * 2);
  });

  it('DDR4 потребляет меньше DDR5', () => {
    const build = withPart(completeBuild(), ram({ type: 'DDR4', speedMts: 3200 }));
    expect(computePower(build).breakdown.memory).toBe(6);
  });

  it('пустая сборка — ноль', () => {
    const report = computePower(emptyBuild());
    expect(report.loadW).toBe(0);
    expect(report.recommendedPsuW).toBe(0);
    expect(report.psuW).toBeUndefined();
  });
});

describe('motherboardPowerW', () => {
  it.each([
    ['X870E', 60],
    ['Z890', 60],
    ['B850', 50],
    ['B760', 45],
    ['A620', 35],
  ])('%s → %i Вт', (chipset, watts) => expect(motherboardPowerW(chipset)).toBe(watts));
});

describe('roundUpToStep', () => {
  it('округляет вверх до 50 Вт', () => {
    expect(roundUpToStep(601)).toBe(650);
    expect(roundUpToStep(650)).toBe(650);
  });
});
