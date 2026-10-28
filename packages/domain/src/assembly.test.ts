import { describe, expect, it } from 'vitest';
import { dimmFillOrder, fitsInCase, layoutBuild } from './assembly';
import { emptyBuild } from './catalog';
import { checkBuild } from './compat/engine';
import {
  aio,
  caseFan,
  completeBuild,
  gpu,
  hdd,
  pcCase,
  ram,
  storage,
  withPart,
} from './test/fixtures';

describe('раскладка сборки в корпусе', () => {
  it('совместимая сборка целиком внутри корпуса, у каждого слота есть камера', () => {
    const build = completeBuild();
    expect(checkBuild(build).issues.filter((i) => i.severity === 'error')).toEqual([]);
    const layout = layoutBuild(build);
    expect(layout.defaultCase).toBe(false);
    for (const placement of layout.placements) {
      expect(fitsInCase(layout, placement), placement.id).toBe(true);
    }
    for (const slot of ['motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu'] as const) {
      expect(
        layout.placements.some((p) => p.slot === slot),
        slot,
      ).toBe(true);
      expect(layout.cameras[slot].distance).toBeGreaterThan(0);
    }
    expect(Object.keys(layout.ghosts)).toEqual([]);
  });

  it('слишком длинная видеокарта выходит за корпус — как и говорит движок совместимости', () => {
    const small = pcCase({
      maxGpuLengthMm: 336,
      dimensionsMm: { height: 274, width: 185, depth: 376 },
      formFactor: 'sff',
    });
    const build = withPart(withPart(completeBuild(), small), gpu({ lengthMm: 420 }));
    expect(checkBuild(build).issues.map((i) => i.code)).toContain('gpu.tooLong');
    const layout = layoutBuild(build);
    const card = layout.placements.find((p) => p.slot === 'gpu')!;
    expect(fitsInCase(layout, card)).toBe(false);
  });

  it('пустая сборка: условный корпус и «призраки» обязательных слотов', () => {
    const layout = layoutBuild(emptyBuild());
    expect(layout.defaultCase).toBe(true);
    expect(layout.placements).toEqual([]);
    expect(Object.keys(layout.ghosts).sort()).toEqual([
      'cooler',
      'cpu',
      'gpu',
      'motherboard',
      'psu',
      'ram',
      'storage',
    ]);
  });

  it('память: два модуля — в слоты A2 и B2', () => {
    expect(dimmFillOrder(4, 2)).toEqual([1, 3]);
    expect(dimmFillOrder(4, 4)).toEqual([0, 1, 2, 3]);
    expect(dimmFillOrder(2, 2)).toEqual([0, 1]);
    const layout = layoutBuild(withPart(completeBuild(), ram({ modules: 2 })));
    const modules = layout.placements.filter((p) => p.slot === 'ram');
    expect(modules).toHaveLength(2);
    expect(new Set(modules.map((m) => m.position[0])).size).toBe(2);
  });

  it('СЖО: помпа на сокете и радиатор под верхней панелью; верхние вентиляторы не ставятся', () => {
    const build = withPart(withPart(completeBuild(), aio()), caseFan({ packCount: 3 }), 2);
    const layout = layoutBuild(build);
    expect(layout.placements.filter((p) => p.slot === 'cooler').map((p) => p.part)).toEqual([
      'pump',
      'radiator',
    ]);
    const fans = layout.placements.filter((p) => p.slot === 'case_fan');
    expect(fans.length).toBe(4); // 3 спереди + 1 сзади, верх занят радиатором
    expect(fans.every((f) => f.orientation !== 'fan-top')).toBe(true);
  });

  it('накопители: NVMe на плату под углом, HDD — в отсек спереди', () => {
    const layout = layoutBuild(withPart(withPart(completeBuild(), storage()), hdd()));
    const drives = layout.placements.filter((p) => p.slot === 'storage');
    expect(drives.some((d) => d.orientation === 'board' && d.installTilt)).toBe(true);
    expect(drives.some((d) => d.orientation === 'flat' && d.installFrom[0] > 0)).toBe(true);
  });

  it('ключи деталей стабильны: замена видеокарты меняет только её ключ', () => {
    const build = completeBuild();
    const before = layoutBuild(build).placements.map((p) => p.id);
    const card = gpu({ lengthMm: 340 });
    const after = layoutBuild(withPart(build, card)).placements.map((p) => p.id);
    expect(after.filter((id) => !before.includes(id))).toEqual([`gpu:${card.id}`]);
    expect(before.filter((id) => !after.includes(id))).toHaveLength(1);
  });
});
