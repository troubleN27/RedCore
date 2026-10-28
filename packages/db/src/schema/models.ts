import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './catalog';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

/**
 * Свои 3D-модели, загруженные из админки. Файл лежит в R2 (url) или — без R2, в dev и
 * на демо-стенде — прямо в базе (data) и отдаётся через /api/models/<id>.
 */
export const models3d = pgTable(
  'models_3d',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid().references(() => products.id, { onDelete: 'set null' }),
    filename: text().notNull(),
    storage: text({ enum: ['r2', 'db'] }).notNull(),
    url: text().notNull(),
    data: bytea(),
    sizeBytes: integer().notNull(),
    triangles: integer().notNull(),
    uploadedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('models_3d_product_idx').on(t.productId)],
);

export type Model3dRow = typeof models3d.$inferSelect;
