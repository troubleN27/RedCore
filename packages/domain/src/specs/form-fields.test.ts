import { describe, expect, it } from 'vitest';
import { componentTypes } from './enums';
import { specFormFields } from './form-fields';

describe('поля формы из Zod-схем', () => {
  it('есть для каждой категории', () => {
    for (const type of componentTypes) expect(specFormFields(type).length).toBeGreaterThan(0);
  });

  it('типы полей процессора', () => {
    const fields = new Map(specFormFields('cpu').map((f) => [f.key, f]));
    expect(fields.get('socket')).toMatchObject({
      kind: 'enum',
      options: expect.arrayContaining(['AM5', 'LGA1700']),
    });
    expect(fields.get('cores')).toMatchObject({ kind: 'number' });
    expect(fields.get('integratedGraphics')).toMatchObject({ kind: 'boolean' });
    expect(fields.get('memoryTypes')).toMatchObject({ kind: 'multi', options: ['DDR4', 'DDR5'] });
    expect(fields.get('pcieGen')).toMatchObject({ kind: 'enum', options: [3, 4, 5] });
  });

  it('варианты кулера объединяются, kind — выбор из списка', () => {
    const fields = new Map(specFormFields('cooler').map((f) => [f.key, f]));
    expect(fields.get('kind')).toMatchObject({ kind: 'enum' });
    expect((fields.get('kind') as { options: string[] }).options.length).toBeGreaterThan(1);
    expect(fields.has('radiatorMm')).toBe(true);
    expect(fields.has('heightMm')).toBe(true);
  });
});
