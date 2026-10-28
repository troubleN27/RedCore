import registry from '@/generated/models.json';

// Реестр собранных GLB: его пишет `pnpm assets:build` (tooling/3d). Пока модели не скачаны,
// реестр пустой и все подтипы показываются процедурными моделями.

export interface BuiltModel {
  /** Путь к LOD0 и LOD1 в public/models */
  lod0: string;
  lod1: string;
  sizeLod0: number;
  sizeLod1: number;
  triangles: number;
}

const models = registry as Record<string, BuiltModel>;

export function builtModel(key: string | null | undefined): BuiltModel | null {
  return key ? (models[key] ?? null) : null;
}
