import { describe, expect, it } from 'vitest';
import {
  canOfferAssembly,
  computeQuote,
  normalizePromoCode,
  normalizeUzPhone,
  toChargeMinor,
  type QuotePromo,
  type QuoteZone,
} from './quote';

const courier: QuoteZone = {
  priceUzs: 50_000,
  freeFromUzs: 5_000_000,
  codAllowed: true,
  isPickup: false,
};
const pickup: QuoteZone = { priceUzs: 0, freeFromUzs: null, codAllowed: true, isPickup: true };

const promo = (over: Partial<QuotePromo> = {}): QuotePromo => ({
  code: 'REDCORE10',
  type: 'percent',
  value: 10,
  minOrderUzs: null,
  maxDiscountUzs: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perUserLimit: null,
  usedCount: 0,
  appliesTo: null,
  isActive: true,
  ...over,
});

const cpu = { productId: 'cpu', componentType: 'cpu', priceUzs: 6_420_000, qty: 1 };
const mouse = { productId: 'mouse', componentType: 'mouse', priceUzs: 1_000_001, qty: 2 };

describe('computeQuote', () => {
  it('подытог, доставка и услуги', () => {
    const q = computeQuote({
      lines: [{ ...cpu, priceUzs: 1_000_000, qty: 2 }],
      zone: courier,
      services: [{ key: 'pc_assembly', priceUzs: 350_000 }],
    });
    expect(q).toMatchObject({
      subtotalUzs: 2_000_000,
      deliveryUzs: 50_000,
      servicesUzs: 350_000,
      totalUzs: 2_400_000,
      freeDeliveryRemainingUzs: 3_000_000,
    });
  });

  it('бесплатная доставка от порога и при самовывозе', () => {
    expect(computeQuote({ lines: [cpu], zone: courier }).deliveryUzs).toBe(0);
    expect(computeQuote({ lines: [{ ...cpu, priceUzs: 10 }], zone: pickup }).deliveryUzs).toBe(0);
  });

  it('пустая корзина — без доставки', () => {
    expect(computeQuote({ lines: [], zone: courier }).totalUzs).toBe(0);
  });

  it('процентный промокод с потолком и раскладкой по позициям', () => {
    const q = computeQuote({
      lines: [cpu, mouse],
      zone: pickup,
      promo: promo({ maxDiscountUzs: 500_000 }),
    });
    expect(q.discountUzs).toBe(500_000);
    expect(q.lineDiscounts.reduce((a, b) => a + b, 0)).toBe(500_000);
    expect(q.totalUzs).toBe(6_420_000 + 2_000_002 - 500_000);
  });

  it('промокод только на периферию', () => {
    const q = computeQuote({
      lines: [cpu, mouse],
      zone: pickup,
      promo: promo({ value: 15, appliesTo: { componentTypes: ['mouse'] } }),
    });
    expect(q.discountUzs).toBe(Math.floor(2_000_002 * 0.15));
    expect(q.lineDiscounts[0]).toBe(0);
    const onlyCpu = computeQuote({
      lines: [cpu],
      zone: pickup,
      promo: promo({ appliesTo: { componentTypes: ['mouse'] } }),
    });
    expect(onlyCpu.promo).toEqual({ code: 'REDCORE10', applied: false, error: 'not_applicable' });
  });

  it('фиксированная скидка не больше суммы', () => {
    const q = computeQuote({
      lines: [{ ...cpu, priceUzs: 100_000 }],
      zone: pickup,
      promo: promo({ type: 'fixed', value: 200_000 }),
    });
    expect(q.discountUzs).toBe(100_000);
    expect(q.totalUzs).toBe(0);
  });

  it.each([
    [{ isActive: false }, 'inactive'],
    [{ startsAt: new Date('2027-01-01') }, 'not_started'],
    [{ endsAt: new Date('2026-09-01') }, 'expired'],
    [{ minOrderUzs: 10_000_000 }, 'min_order'],
    [{ usageLimit: 5, usedCount: 5 }, 'usage_limit'],
    [{ perUserLimit: 1 }, 'per_user_limit'],
  ] as const)('промокод отклонён: %o → %s', (over, error) => {
    const q = computeQuote({
      lines: [cpu],
      zone: pickup,
      promo: promo(over),
      promoUsedByCustomer: 1,
      now: new Date('2026-10-27'),
    });
    expect(q.promo).toEqual({ code: 'REDCORE10', applied: false, error });
    expect(q.discountUzs).toBe(0);
  });

  it('скидка учитывается в пороге бесплатной доставки', () => {
    const q = computeQuote({
      lines: [{ ...cpu, priceUzs: 5_000_000 }],
      zone: courier,
      promo: promo(),
    });
    expect(q.deliveryUzs).toBe(50_000);
  });
});

describe('вспомогательные', () => {
  it('сборка предлагается при CPU и плате', () => {
    expect(canOfferAssembly(['cpu', 'motherboard', 'gpu'])).toBe(true);
    expect(canOfferAssembly(['cpu'])).toBe(false);
  });

  it('промокод и телефон нормализуются', () => {
    expect(normalizePromoCode(' redcore 10 ')).toBe('REDCORE10');
    expect(normalizeUzPhone('+998 (90) 123-45-67')).toBe('+998901234567');
    expect(normalizeUzPhone('901234567')).toBe('+998901234567');
    expect(normalizeUzPhone('+7 916 123 45 67')).toBeNull();
    expect(normalizeUzPhone('+998 12 345 67 89')).toBeNull();
  });

  it('сумма списания: UZS ×100, USD по курсу с округлением вверх', () => {
    expect(toChargeMinor(12_450_000, 'uzs')).toBe(1_245_000_000);
    expect(toChargeMinor(11_862, 'usd', 11_861.96)).toBe(101);
    expect(() => toChargeMinor(1, 'usd')).toThrow();
  });
});
