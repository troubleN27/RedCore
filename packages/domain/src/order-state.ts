// Машина состояний заказа. Статус исполнения и статус оплаты разделены:
// у оплаты при получении деньги поступают только при доставке.

export const orderStatuses = [
  'draft',
  'created',
  'pending_payment',
  'paid',
  'assembling',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = [
  'unpaid',
  'pending',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export type PaymentMethod = 'card' | 'cod';

export type OrderActor = 'customer' | 'admin' | 'system' | 'webhook' | 'agent';

interface Transition {
  to: OrderStatus;
  /** Кто может выполнить переход */
  actors: readonly OrderActor[];
  /** Ограничение по способу оплаты */
  methods?: readonly PaymentMethod[];
}

const transitions: Record<OrderStatus, readonly Transition[]> = {
  // Черновик — от AI-агента или MCP; клиент подтверждает его в checkout
  draft: [
    { to: 'created', actors: ['customer', 'admin'] },
    { to: 'cancelled', actors: ['customer', 'admin', 'system'] },
  ],
  created: [
    { to: 'pending_payment', actors: ['system'], methods: ['card'] },
    // Оплата при получении: менеджер подтвердил заказ — начинаем сборку
    { to: 'assembling', actors: ['admin'], methods: ['cod'] },
    { to: 'cancelled', actors: ['customer', 'admin', 'system'] },
  ],
  pending_payment: [
    { to: 'paid', actors: ['webhook'] },
    { to: 'cancelled', actors: ['webhook', 'system', 'admin', 'customer'] },
  ],
  paid: [
    { to: 'assembling', actors: ['admin', 'system'] },
    { to: 'refunded', actors: ['admin', 'webhook'] },
  ],
  assembling: [
    { to: 'shipped', actors: ['admin'] },
    { to: 'cancelled', actors: ['admin'], methods: ['cod'] },
    { to: 'refunded', actors: ['admin', 'webhook'], methods: ['card'] },
  ],
  shipped: [
    { to: 'delivered', actors: ['admin', 'system'] },
    { to: 'refunded', actors: ['admin', 'webhook'], methods: ['card'] },
    { to: 'cancelled', actors: ['admin'], methods: ['cod'] },
  ],
  delivered: [{ to: 'refunded', actors: ['admin', 'webhook'] }],
  cancelled: [],
  refunded: [],
};

export const terminalStatuses: readonly OrderStatus[] = ['cancelled', 'refunded'];

export interface TransitionRequest {
  from: OrderStatus;
  to: OrderStatus;
  actor: OrderActor;
  method: PaymentMethod;
}

export type TransitionCheck =
  | { ok: true; idempotent: boolean }
  | { ok: false; reason: 'not_allowed' | 'forbidden_actor' | 'wrong_payment_method' | 'terminal' };

/**
 * Проверяет переход статуса. Повтор того же статуса — идемпотентный no-op:
 * вебхук Stripe может прийти дважды, и второй раз ничего не должен менять.
 */
export function canTransition({ from, to, actor, method }: TransitionRequest): TransitionCheck {
  if (from === to) return { ok: true, idempotent: true };
  if (terminalStatuses.includes(from)) return { ok: false, reason: 'terminal' };
  const transition = transitions[from].find((t) => t.to === to);
  if (!transition) return { ok: false, reason: 'not_allowed' };
  if (!transition.actors.includes(actor)) return { ok: false, reason: 'forbidden_actor' };
  if (transition.methods && !transition.methods.includes(method)) {
    return { ok: false, reason: 'wrong_payment_method' };
  }
  return { ok: true, idempotent: false };
}

export function nextStatuses(
  from: OrderStatus,
  actor: OrderActor,
  method: PaymentMethod,
): OrderStatus[] {
  return transitions[from]
    .filter((t) => t.actors.includes(actor) && (!t.methods || t.methods.includes(method)))
    .map((t) => t.to);
}

/** Статус оплаты, который выставляется вместе со статусом заказа. */
export function paymentStatusAfter(
  status: OrderStatus,
  method: PaymentMethod,
  current: PaymentStatus,
): PaymentStatus {
  switch (status) {
    case 'pending_payment':
      return 'pending';
    case 'paid':
      return 'paid';
    case 'delivered':
      return method === 'cod' ? 'paid' : current;
    case 'refunded':
      return 'refunded';
    case 'cancelled':
      return current === 'pending' ? 'failed' : current;
    default:
      return current;
  }
}

/** Когда остатки списываются окончательно (резерв ставится при создании заказа). */
export function commitsStock(status: OrderStatus, method: PaymentMethod): boolean {
  return method === 'card' ? status === 'paid' : status === 'assembling';
}

/** Когда резерв освобождается. */
export function releasesReservation(status: OrderStatus): boolean {
  return status === 'cancelled';
}
