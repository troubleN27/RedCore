import type { ComponentType, SpecsByType } from '@redcore/domain';
import { componentTypes } from '@redcore/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const localeEnum = pgEnum('locale', ['ru', 'uz']);
export const componentTypeEnum = pgEnum('component_type', componentTypes);
export const categoryKindEnum = pgEnum('category_kind', ['component', 'peripheral', 'prebuilt']);
export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'archived']);
export const filterTypeEnum = pgEnum('filter_type', ['enum', 'range', 'boolean']);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Локализованная строка для коротких справочных полей (имена зон доставки, услуг). */
export type LocalizedText = { ru: string; uz: string };

export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    kind: categoryKindEnum().notNull(),
    componentType: componentTypeEnum().notNull(),
    sort: integer().notNull().default(0),
    icon: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug)],
);

export const categoryTranslations = pgTable(
  'category_translations',
  {
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    name: text().notNull(),
    description: text(),
    seoTitle: text(),
    seoDescription: text(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] })],
);

export const brands = pgTable(
  'brands',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    logoUrl: text(),
  },
  (t) => [uniqueIndex('brands_slug_idx').on(t.slug)],
);

/**
 * Привязка 3D-модели: базовая GLB из манифеста (baseKey) или своя модель, загруженная из
 * админки (customUrl). Без привязки сцена строит процедурную модель по характеристикам.
 */
export interface Model3dRef {
  baseKey?: string;
  customUrl?: string;
  sizeBytes?: number;
  triangles?: number;
  params?: Record<string, unknown>;
}

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    sku: text().notNull(),
    slug: text().notNull(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    componentType: componentTypeEnum().notNull(),
    /** Модель без бренда — заголовок карточки на обоих языках */
    name: text().notNull(),
    status: productStatusEnum().notNull().default('active'),
    priceUzs: bigint({ mode: 'number' }).notNull(),
    compareAtPriceUzs: bigint({ mode: 'number' }),
    /** Себестоимость — для маржи в аналитике админки */
    costUzs: bigint({ mode: 'number' }),
    stockQty: integer().notNull().default(0),
    reservedQty: integer().notNull().default(0),
    warrantyMonths: integer().notNull().default(12),
    /** Характеристики, валидируются Zod-схемой @redcore/domain по componentType */
    specs: jsonb().$type<SpecsByType[ComponentType]>().notNull(),
    /** Нормализованный текст для поиска и автодополнения (см. buildSearchText) */
    searchText: text().notNull().default(''),
    /** Ключ в perf_cpu / perf_gpu */
    perfKey: text(),
    /** Базовая 3D-модель и параметры (этап 6) */
    model3d: jsonb().$type<Model3dRef>(),
    isFeatured: boolean().notNull().default(false),
    ratingAvg: real().notNull().default(0),
    ratingCount: integer().notNull().default(0),
    popularity: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    uniqueIndex('products_sku_idx').on(t.sku),
    index('products_category_status_idx').on(t.categoryId, t.status),
    index('products_type_idx').on(t.componentType),
    index('products_specs_idx').using('gin', sql`${t.specs} jsonb_path_ops`),
  ],
);

export const productTranslations = pgTable(
  'product_translations',
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    shortDescription: text().notNull(),
    description: text(),
    seoTitle: text(),
    seoDescription: text(),
    /** human — написано вручную, ai — сгенерировано агентом и ждёт ревью */
    source: text({ enum: ['human', 'template', 'ai'] })
      .notNull()
      .default('template'),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    width: integer(),
    height: integer(),
    blurDataUrl: text(),
    alt: jsonb().$type<LocalizedText>(),
    sort: integer().notNull().default(0),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

/** Фасетные фильтры каталога — управляются из админки; подписи — i18n-ключи filters.<type>.<key>. */
export const categoryFilters = pgTable(
  'category_filters',
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    specKey: text().notNull(),
    type: filterTypeEnum().notNull(),
    unit: text(),
    sort: integer().notNull().default(0),
    /** Участвует в проверке совместимости (сокет, тип памяти…) */
    isCompatibilityKey: boolean().notNull().default(false),
  },
  (t) => [uniqueIndex('category_filters_key_idx').on(t.categoryId, t.specKey)],
);

/** Состав готовой сборки: компоненты — обычные товары каталога. */
export const prebuiltComponents = pgTable(
  'prebuilt_components',
  {
    prebuiltId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    componentId: uuid()
      .notNull()
      .references(() => products.id),
    qty: integer().notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.prebuiltId, t.componentId] })],
);

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
