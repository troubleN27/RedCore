import { integer, pgEnum, pgTable, real, text } from 'drizzle-orm/pg-core';

// Индексы производительности относительно эталонов: RTX 5070 = 1.00, Ryzen 7 9800X3D = 1.00.
// Источник — агрегированные обзоры; редактируются в админке (этап 8) и калибруются по замерам.

export const gpuVendorEnum = pgEnum('gpu_vendor', ['nvidia', 'amd', 'intel']);
export const frameGenEnum = pgEnum('frame_gen', ['none', 'fg', 'mfg']);

export const perfGpu = pgTable('perf_gpu', {
  key: text().primaryKey(),
  name: text().notNull(),
  vendor: gpuVendorEnum().notNull(),
  index1080: real().notNull(),
  index1440: real().notNull(),
  index2160: real().notNull(),
  rtIndex: real(),
  frameGen: frameGenEnum().notNull().default('none'),
  upscalers: text().array().notNull().default([]),
  /** Видеопамять типовой карты на чипе — для калькулятора FPS без выбранного товара */
  vramGb: integer().notNull().default(8),
});

export const perfCpu = pgTable('perf_cpu', {
  key: text().primaryKey(),
  name: text().notNull(),
  gamingIndex: real().notNull(),
  multiThreadIndex: real().notNull(),
});

export type PerfGpuRow = typeof perfGpu.$inferSelect;
export type PerfCpuRow = typeof perfCpu.$inferSelect;
