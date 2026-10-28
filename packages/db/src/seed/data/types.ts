import type { ComponentType } from '@redcore/domain';
import type { z } from 'zod';
import type { specSchemas } from '@redcore/domain';

/** Сырые характеристики до валидации (значения по умолчанию подставит Zod). */
export type SpecsInput<T extends ComponentType> = z.input<(typeof specSchemas)[T]>;

export interface ProductSeed<T extends ComponentType = ComponentType> {
  type: T;
  brand: string;
  /** Модель без бренда: «Ryzen 7 9800X3D» */
  name: string;
  /** Розничная цена в долларах — пересчитывается в сумы по курсу seed */
  usd: number;
  /** Цена до скидки в долларах, если товар со скидкой */
  compareAtUsd?: number;
  /** Остаток; по умолчанию — детерминированный от slug */
  stock?: number;
  specs: SpecsInput<T>;
  perfKey?: string;
  warrantyMonths?: number;
  featured?: boolean;
}

export function products<T extends ComponentType>(
  type: T,
  list: Omit<ProductSeed<T>, 'type'>[],
): ProductSeed<T>[] {
  return list.map((item) => ({ ...item, type }));
}
