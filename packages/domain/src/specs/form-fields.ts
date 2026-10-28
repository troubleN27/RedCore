import type { ComponentType } from './enums';
import { specSchemas } from './schemas';

// Описание полей формы характеристик, построенное из Zod-схемы категории: админка рисует
// по нему форму, а сохранение всё равно проверяется той же схемой (safeParseSpecs).

export type SpecField =
  | { key: string; kind: 'number'; integer: boolean; optional: boolean }
  | { key: string; kind: 'boolean'; optional: boolean }
  | { key: string; kind: 'text'; optional: boolean }
  | { key: string; kind: 'enum'; options: (string | number)[]; optional: boolean }
  | { key: string; kind: 'multi'; options: (string | number)[] | null; optional: boolean }
  | { key: string; kind: 'json'; optional: boolean };

interface ZodLike {
  _zod: { def: Record<string, unknown> & { type: string } };
}

const defOf = (schema: unknown) => (schema as ZodLike)._zod.def;

function unwrap(schema: unknown): { schema: unknown; optional: boolean } {
  let current = schema;
  let optional = false;
  for (;;) {
    const def = defOf(current);
    if (
      def.type === 'optional' ||
      def.type === 'default' ||
      def.type === 'nullable' ||
      def.type === 'prefault'
    ) {
      optional = optional || def.type !== 'default';
      current = def.innerType;
    } else if (def.type === 'pipe') {
      current = def.in;
    } else return { schema: current, optional };
  }
}

/** Варианты значения для enum, union литералов и literal; иначе null. */
function choices(schema: unknown): (string | number)[] | null {
  const def = defOf(schema);
  if (def.type === 'enum') return Object.values(def.entries as Record<string, string | number>);
  if (def.type === 'literal') return [...(def.values as (string | number)[])];
  if (def.type === 'union') {
    const all = (def.options as unknown[]).map(choices);
    return all.every(Boolean) ? [...new Set(all.flat() as (string | number)[])] : null;
  }
  return null;
}

function describe(key: string, raw: unknown): SpecField {
  const { schema, optional } = unwrap(raw);
  const def = defOf(schema);
  const options = choices(schema);
  if (options) return { key, kind: 'enum', options, optional };
  switch (def.type) {
    case 'number':
      return {
        key,
        kind: 'number',
        integer: Boolean(
          (
            def.checks as { _zod?: { def?: { check?: string; format?: string } } }[] | undefined
          )?.some(
            (c) => c._zod?.def?.format === 'safeint' || c._zod?.def?.check === 'number_format',
          ),
        ),
        optional,
      };
    case 'boolean':
      return { key, kind: 'boolean', optional };
    case 'string':
      return { key, kind: 'text', optional };
    case 'array':
      return { key, kind: 'multi', options: choices(unwrap(def.element).schema), optional };
    default:
      return { key, kind: 'json', optional };
  }
}

export function specFormFields(type: ComponentType): SpecField[] {
  const schema = specSchemas[type] as unknown as {
    shape?: Record<string, unknown>;
    options?: { shape: Record<string, unknown> }[];
  };
  if (schema.shape) return Object.entries(schema.shape).map(([key, value]) => describe(key, value));
  // Варианты (например, воздушный кулер и СЖО): общий список полей, дискриминатор — enum
  const fields = new Map<string, SpecField>();
  for (const option of schema.options ?? []) {
    for (const [key, value] of Object.entries(option.shape)) {
      const field = describe(key, value);
      const existing = fields.get(key);
      if (!existing) fields.set(key, { ...field, optional: true });
      else if (existing.kind === 'enum' && field.kind === 'enum') {
        fields.set(key, {
          ...existing,
          options: [...new Set([...existing.options, ...field.options])],
        });
      }
    }
  }
  const [first] = schema.options ?? [];
  // Поля первого варианта, которые есть во всех вариантах, оставляем обязательными
  return [...fields.values()].map((f) =>
    first && (schema.options ?? []).every((o) => f.key in o.shape)
      ? { ...f, optional: describe(f.key, first.shape[f.key]).optional }
      : f,
  );
}
