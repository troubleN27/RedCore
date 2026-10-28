import { describe, expect, it } from 'vitest';
import { componentTypes } from './specs/enums';
import { MM, modelExtent, modelSpecFor } from './model3d';
import { aio, airCooler, gpu, pcCase, ram } from './test/fixtures';

describe('параметры 3D-модели', () => {
  it('для каждого типа товара есть модель', () => {
    for (const type of componentTypes) {
      const spec = modelSpecFor({ componentType: type, specs: {} });
      expect(spec.kind).toBeTruthy();
      expect(modelExtent(spec)).toBeGreaterThan(0);
    }
  });

  it('видеокарта: длина и толщина из характеристик', () => {
    const card = gpu({ lengthMm: 357, slotWidth: 3.5, fans: 3 });
    const spec = modelSpecFor(card);
    expect(spec).toMatchObject({ kind: 'gpu', fans: 3, glbKey: 'gpu_3fan' });
    if (spec.kind !== 'gpu') throw new Error();
    expect(spec.length).toBeCloseTo(0.357, 5);
    expect(spec.thickness).toBeCloseTo(3.5 * 20.32 * MM, 5);
  });

  it('кулер: башня или СЖО, две башни у больших', () => {
    expect(modelSpecFor(airCooler({ heightMm: 168, fans: 2 }))).toMatchObject({
      kind: 'cooler-air',
      towers: 2,
    });
    expect(modelSpecFor(airCooler({ heightMm: 155, fans: 1 }))).toMatchObject({
      kind: 'cooler-air',
      towers: 1,
    });
    expect(modelSpecFor(aio())).toMatchObject({ kind: 'cooler-aio' });
  });

  it('корпус — габариты и цвет', () => {
    const spec = modelSpecFor(pcCase({ color: 'white' }));
    expect(spec).toMatchObject({ kind: 'case', finish: 'white' });
  });

  it('память с подсветкой — RGB-модель', () => {
    expect(modelSpecFor(ram({ rgb: true }))).toMatchObject({
      kind: 'ram',
      rgb: true,
      glbKey: 'ram_rgb',
    });
  });

  it('форм-факторы и подтипы по характеристикам', () => {
    const spec = (
      componentType: Parameters<typeof modelSpecFor>[0]['componentType'],
      specs: Record<string, unknown>,
    ) => modelSpecFor({ componentType, specs });
    expect(spec('motherboard', { formFactor: 'Mini-ITX', memorySlots: 2 })).toMatchObject({
      glbKey: null,
      dimm: 2,
    });
    expect(spec('motherboard', { formFactor: 'ATX' })).toMatchObject({ glbKey: 'mb_atx' });
    expect(spec('cpu', { socket: 'LGA1851' })).toMatchObject({
      vendor: 'intel',
      glbKey: 'cpu_intel',
    });
    expect(spec('cpu', { socket: 'AM4' })).toMatchObject({ vendor: 'amd', glbKey: 'cpu_am4' });
    expect(spec('psu', { formFactor: 'SFX' })).toMatchObject({ glbKey: null });
    expect(spec('psu', { formFactor: 'SFX-L' })).toMatchObject({ kind: 'psu' });
    expect(spec('storage', { formFactor: '2.5' })).toMatchObject({ form: '2.5', glbKey: 'ssd_25' });
    expect(spec('storage', { formFactor: '3.5' })).toMatchObject({ form: '3.5', glbKey: 'hdd_35' });
    expect(spec('storage', { formFactor: 'm2-2280', heatsink: true })).toMatchObject({
      form: 'm2',
      heatsink: true,
    });
    expect(spec('case_fan', { sizeMm: 140, packCount: 3, lighting: 'argb' })).toMatchObject({
      rgb: true,
      count: 3,
    });
    expect(spec('case_fan', { lighting: 'none' })).toMatchObject({ rgb: false, count: 1 });
    expect(spec('cooler', { kind: 'air', heightMm: 37, lowProfile: true, fans: 1 })).toMatchObject({
      lowProfile: true,
      towers: 1,
    });
    expect(
      spec('monitor', { sizeInch: 34, resolution: { width: 3440, height: 1440 }, curved: true }),
    ).toMatchObject({ curved: true });
    expect(spec('keyboard', { formFactor: 'tkl', rgb: true })).toMatchObject({ rgb: true });
    expect(spec('mouse', { weightG: 55 })).toMatchObject({ length: 0.118 });
    expect(spec('mousepad', { widthMm: 900, heightMm: 400, rgb: true })).toMatchObject({
      rgb: true,
    });
    expect(spec('ram', { heightMm: 44, rgb: false })).toMatchObject({ glbKey: null });
    expect(spec('case', { formFactor: 'sff', glassPanel: false })).toMatchObject({
      glbKey: null,
      glass: false,
    });
    expect(spec('gpu', { fans: 2, color: 'white' })).toMatchObject({
      glbKey: 'gpu_2fan',
      finish: 'white',
    });
    expect(spec('prebuilt', {})).toMatchObject({ kind: 'case', rgb: true });
    expect(spec('ram', { color: 'unknown' })).toMatchObject({ finish: 'black' });
  });
});
