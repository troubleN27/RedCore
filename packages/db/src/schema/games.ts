import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { GameData } from '@redcore/domain';

// Калькулятор FPS (план, §5 и §7.2): игры, FPS эталонной видеокарты по разрешениям и
// пресетам и потолок эталонного процессора. Всё редактируется в консоли и импортируется CSV.

export const gameProfileEnum = pgEnum('game_profile', ['aaa', 'competitive']);
export const resolutionEnum = pgEnum('fps_resolution', ['1080p', '1440p', '2160p']);
export const presetEnum = pgEnum('fps_preset', ['low', 'medium', 'high', 'ultra']);

export const games = pgTable(
  'games',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    steamAppId: integer(),
    coverUrl: text(),
    /** Акцент карточки без обложки (оттенок HSL) */
    hue: integer().notNull().default(0),
    profile: gameProfileEnum().notNull().default('aaa'),
    cpuAlpha: real().notNull().default(0.8),
    vendorBias: jsonb().$type<GameData['vendorBias']>().notNull().default({}),
    ramMinGb: integer().notNull().default(16),
    ramRecGb: integer().notNull().default(16),
    supports: jsonb()
      .$type<GameData['supports']>()
      .notNull()
      .default({ dlss: false, fsr: false, xess: false, frameGen: false }),
    thresholds: jsonb()
      .$type<GameData['thresholds']>()
      .notNull()
      .default({ good: 60, playable: 30 }),
    lowRatio: real().notNull().default(0.78),
    fpsCap: integer(),
    isActive: boolean().notNull().default(true),
    sort: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('games_sort_idx').on(t.sort)],
);

/** G[r][p] — FPS эталонной видеокарты (RTX 5070) и требование к видеопамяти. */
export const gameBenchmarks = pgTable(
  'game_benchmarks',
  {
    gameId: uuid()
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    resolution: resolutionEnum().notNull(),
    preset: presetEnum().notNull(),
    refFpsGpu: real().notNull(),
    vramReqGb: real().notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.resolution, t.preset] })],
);

/** C[p] — потолок эталонного процессора (Ryzen 7 9800X3D). */
export const gameCpuCaps = pgTable(
  'game_cpu_caps',
  {
    gameId: uuid()
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    preset: presetEnum().notNull(),
    refFpsCpu: real().notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.preset] })],
);

export type GameRow = typeof games.$inferSelect;
export type GameBenchmarkRow = typeof gameBenchmarks.$inferSelect;
