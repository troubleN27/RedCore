import type { AnyCatalogProduct, ComponentType } from '@redcore/domain';
import type { Locale } from '@redcore/i18n';

export interface CategoryInfo {
  id: string;
  slug: string;
  componentType: ComponentType;
  kind: 'component' | 'peripheral' | 'prebuilt';
  icon: string | null;
  name: string;
  description: string | null;
  productCount: number;
  inStockCount: number;
  /** Минимальная цена в категории — для плиток «от … сум» */
  minPriceUzs: number | null;
}

export interface FilterDefinition {
  key: string;
  type: 'enum' | 'range' | 'boolean';
  unit: string | null;
  isCompatibilityKey: boolean;
}

/** Товар в списках: каталог, поиск, сравнение, избранное. */
export type ProductSummary = AnyCatalogProduct & {
  categorySlug: string;
  compareAtPriceUzs: number | null;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  popularity: number;
  shortDescription: string;
  searchText: string;
  warrantyMonths: number;
  /** Остаток минус резерв */
  available: number;
};

export interface ProductDetail extends Omit<ProductSummary, 'searchText'> {
  category: { slug: string; name: string };
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Только у готовых сборок */
  components: ProductSummary[];
  /** Привязка 3D-модели (своя GLB из админки или ключ базовой) */
  model3d: { baseKey?: string; customUrl?: string } | null;
}

export interface CatalogSnapshot {
  locale: Locale;
  categories: CategoryInfo[];
  filters: Map<string, FilterDefinition[]>;
  products: ProductSummary[];
  bySlug: Map<string, ProductSummary>;
  /** Состав готовых сборок: slug сборки → slug компонентов */
  prebuiltComponents: Map<string, string[]>;
  loadedAt: number;
}

export type RangeValue = { min?: number; max?: number };

/** Выбранные фильтры: значения перечислений, диапазон или «да». */
export type FilterSelection = Record<string, string[] | RangeValue | true>;

export const sortOptions = ['popular', 'price-asc', 'price-desc', 'name', 'new'] as const;
export type SortOption = (typeof sortOptions)[number];

export interface CatalogQuery {
  filters: FilterSelection;
  sort: SortOption;
  page: number;
  inStockOnly: boolean;
}

export interface Facet {
  key: string;
  type: FilterDefinition['type'];
  unit: string | null;
  isCompatibilityKey: boolean;
  /** enum: значения со счётчиками с учётом остальных фильтров */
  values?: { value: string; count: number }[];
  /** range: границы по всей категории */
  min?: number;
  max?: number;
  /** boolean: сколько товаров со значением «да» */
  trueCount?: number;
}

export interface CatalogPage {
  category: CategoryInfo;
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: Facet[];
  query: CatalogQuery;
}
