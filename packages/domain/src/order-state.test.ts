import { describe, expect, it } from 'vitest';
import {
  canTransition,
  commitsStock,
  nextStatuses,
  paymentStatusAfter,
  releasesReservation,
} from './order-state';

describe('canTransition', () => {
  it('оплата картой: только вебхук переводит в «оплачен»', () => {
    expect(
      canTransition({ from: 'pending_payment', to: 'paid', actor: 'webhook', method: 'card' }),
    ).toEqual({ ok: true, idempotent: false });
    expect(
      canTransition({ from: 'pending_payment', to: 'paid', actor: 'admin', method: 'card' }),
    ).toEqual({ ok: false, reason: 'forbidden_actor' });
  });

  it('повтор того же статуса — идемпотентный no-op (дубль вебхука)', () => {
    expect(canTransition({ from: 'paid', to: 'paid', actor: 'webhook', method: 'card' })).toEqual({
      ok: true,
      idempotent: true,
    });
  });

  it('нельзя перескочить через статусы', () => {
    expect(
      canTransition({ from: 'created', to: 'shipped', actor: 'admin', method: 'card' }),
    ).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('из терминальных статусов выхода нет', () => {
    expect(
      canTransition({ from: 'cancelled', to: 'created', actor: 'admin', method: 'cod' }),
    ).toEqual({ ok: false, reason: 'terminal' });
    expect(
      canTransition({ from: 'refunded', to: 'paid', actor: 'webhook', method: 'card' }),
    ).toEqual({ ok: false, reason: 'terminal' });
  });

  it('оплата при получении: менеджер сразу запускает сборку', () => {
    expect(
      canTransition({ from: 'created', to: 'assembling', actor: 'admin', method: 'cod' }).ok,
    ).toBe(true);
    expect(
      canTransition({ from: 'created', to: 'assembling', actor: 'admin', method: 'card' }),
    ).toEqual({ ok: false, reason: 'wrong_payment_method' });
  });

  it('возврат денег возможен только при оплате картой', () => {
    expect(
      canTransition({ from: 'shipped', to: 'refunded', actor: 'admin', method: 'card' }).ok,
    ).toBe(true);
    expect(
      canTransition({ from: 'shipped', to: 'refunded', actor: 'admin', method: 'cod' }).ok,
    ).toBe(false);
  });

  it('черновик от агента подтверждает клиент', () => {
    expect(
      canTransition({ from: 'draft', to: 'created', actor: 'customer', method: 'card' }).ok,
    ).toBe(true);
    expect(canTransition({ from: 'draft', to: 'created', actor: 'agent', method: 'card' }).ok).toBe(
      false,
    );
  });
});

describe('nextStatuses', () => {
  it('для админа по COD-заказу в сборке', () => {
    expect(nextStatuses('assembling', 'admin', 'cod')).toEqual(['shipped', 'cancelled']);
  });
  it('для клиента после создания', () => {
    expect(nextStatuses('created', 'customer', 'card')).toEqual(['cancelled']);
  });
});

describe('оплата и остатки', () => {
  it('статус оплаты следует за статусом заказа', () => {
    expect(paymentStatusAfter('pending_payment', 'card', 'unpaid')).toBe('pending');
    expect(paymentStatusAfter('paid', 'card', 'pending')).toBe('paid');
    expect(paymentStatusAfter('delivered', 'cod', 'unpaid')).toBe('paid');
    expect(paymentStatusAfter('delivered', 'card', 'paid')).toBe('paid');
    expect(paymentStatusAfter('cancelled', 'card', 'pending')).toBe('failed');
    expect(paymentStatusAfter('refunded', 'card', 'paid')).toBe('refunded');
    expect(paymentStatusAfter('assembling', 'cod', 'unpaid')).toBe('unpaid');
  });

  it('остатки списываются при оплате (карта) или запуске сборки (COD)', () => {
    expect(commitsStock('paid', 'card')).toBe(true);
    expect(commitsStock('assembling', 'card')).toBe(false);
    expect(commitsStock('assembling', 'cod')).toBe(true);
  });

  it('резерв освобождается при отмене', () => {
    expect(releasesReservation('cancelled')).toBe(true);
    expect(releasesReservation('paid')).toBe(false);
  });
});
