import { allocateByWeights, sumUzs, type Uzs } from './money';

// Расчёт заказа без IO: одинаково считает корзина в браузере, checkout на сервере
// и (позже) AI-агент. Сервер всегда пересчитывает сам — клиентским суммам не доверяем.

export interface QuoteLine {
  productId: string;
  componentType: string;
  priceUzs: Uzs;
  qty: number;
}

export interface QuoteZone {
  priceUzs: Uzs;
  freeFromUzs: Uzs | null;
  codAllowed: boolean;
  isPickup: boolean;
}

export interface QuoteService {
  key: string;
  priceUzs: Uzs;
}

export interface QuotePromo {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderUzs: Uzs | null;
  maxDiscountUzs: Uzs | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  appliesTo: { componentTypes?: string[] } | null;
  isActive: boolean;
}

export type PromoError =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'min_order'
  | 'usage_limit'
  | 'per_user_limit'
  | 'not_applicable';

export interface QuoteInput {
  lines: QuoteLine[];
  zone: QuoteZone;
  services?: QuoteService[];
  promo?: QuotePromo | null;
  /** Сколько раз этот покупатель (по телефону/аккаунту) уже применял промокод */
  promoUsedByCustomer?: number;
  now?: Date;
}

export interface Quote {
  subtotalUzs: Uzs;
  discountUzs: Uzs;
  deliveryUzs: Uzs;
  servicesUzs: Uzs;
  totalUzs: Uzs;
  /** Скидка по позициям в порядке lines — для чека и Stripe */
  lineDiscounts: Uzs[];
  promo:
    { code: string; applied: true } | { code: string; applied: false; error: PromoError } | null;
  /** Сколько не хватает до бесплатной доставки (null — уже бесплатно или самовывоз) */
  freeDeliveryRemainingUzs: Uzs | null;
}

export function validatePromo(
  promo: QuotePromo,
  eligibleSubtotal: Uzs,
  subtotal: Uzs,
  usedByCustomer: number,
  now: Date,
): PromoError | null {
  if (!promo.isActive) return 'inactive';
  if (promo.startsAt && now < promo.startsAt) return 'not_started';
  if (promo.endsAt && now >= promo.endsAt) return 'expired';
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) return 'usage_limit';
  if (promo.perUserLimit !== null && usedByCustomer >= promo.perUserLimit) return 'per_user_limit';
  if (eligibleSubtotal <= 0) return 'not_applicable';
  if (promo.minOrderUzs !== null && subtotal < promo.minOrderUzs) return 'min_order';
  return null;
}

export function promoDiscount(promo: QuotePromo, eligibleSubtotal: Uzs): Uzs {
  const raw =
    promo.type === 'percent'
      ? Math.floor((eligibleSubtotal * promo.value) / 100)
      : Math.min(promo.value, eligibleSubtotal);
  return promo.maxDiscountUzs !== null ? Math.min(raw, promo.maxDiscountUzs) : raw;
}

export function computeQuote({
  lines,
  zone,
  services = [],
  promo = null,
  promoUsedByCustomer = 0,
  now = new Date(),
}: QuoteInput): Quote {
  const lineTotals = lines.map((line) => line.priceUzs * line.qty);
  const subtotalUzs = lines.length > 0 ? sumUzs(lineTotals) : 0;

  let discountUzs = 0;
  let lineDiscounts = lines.map(() => 0);
  let promoResult: Quote['promo'] = null;
  if (promo) {
    const types = promo.appliesTo?.componentTypes;
    const eligible = lines.map((line, i) =>
      !types || types.length === 0 || types.includes(line.componentType) ? lineTotals[i]! : 0,
    );
    const eligibleSubtotal = eligible.reduce((a, b) => a + b, 0);
    const error = validatePromo(promo, eligibleSubtotal, subtotalUzs, promoUsedByCustomer, now);
    if (error) promoResult = { code: promo.code, applied: false, error };
    else {
      discountUzs = promoDiscount(promo, eligibleSubtotal);
      // Скидку раскладываем пропорционально подходящим позициям — сумма сходится до сума
      lineDiscounts = discountUzs > 0 ? allocateByWeights(discountUzs, eligible) : lineDiscounts;
      promoResult = { code: promo.code, applied: true };
    }
  }

  const afterDiscount = subtotalUzs - discountUzs;
  const freeDelivery =
    zone.isPickup || (zone.freeFromUzs !== null && afterDiscount >= zone.freeFromUzs);
  const deliveryUzs = freeDelivery || lines.length === 0 ? 0 : zone.priceUzs;
  const servicesUzs = services.reduce((sum, s) => sum + s.priceUzs, 0);

  return {
    subtotalUzs,
    discountUzs,
    deliveryUzs,
    servicesUzs,
    totalUzs: afterDiscount + deliveryUzs + servicesUzs,
    lineDiscounts,
    promo: promoResult,
    freeDeliveryRemainingUzs:
      zone.isPickup || zone.freeFromUzs === null || freeDelivery
        ? null
        : zone.freeFromUzs - afterDiscount,
  };
}

/** Услуга сборки ПК имеет смысл, если в корзине есть процессор и материнская плата. */
export function canOfferAssembly(componentTypes: readonly string[]): boolean {
  return componentTypes.includes('cpu') && componentTypes.includes('motherboard');
}

/** Нормализация промокода: регистр и пробелы не важны. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** +998 XX XXX XX XX → +998XXXXXXXXX; null — номер не узбекский мобильный/городской. */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('998') ? digits.slice(3) : digits.length === 9 ? digits : null;
  if (!local || local.length !== 9) return null;
  // Коды операторов и городских сетей: 33, 50, 55, 61–79, 77, 88, 90–99
  if (!/^(33|50|55|6[1-9]|7[0-9]|88|9[0-9])/.test(local)) return null;
  return `+998${local}`;
}

/** Сумма списания у провайдера в минимальных единицах: UZS у Stripe двухдесятичная (×100). */
export function toChargeMinor(totalUzs: Uzs, currency: 'uzs' | 'usd', usdRate?: number): number {
  if (currency === 'uzs') return totalUzs * 100;
  if (!usdRate || usdRate <= 0) throw new RangeError('usdRate is required for usd charges');
  return Math.ceil((totalUzs / usdRate) * 100);
}
