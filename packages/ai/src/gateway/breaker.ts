/**
 * Circuit breaker: после отказа всей цепочки моделей 60 с не дёргаем API, а сразу отвечаем
 * детерминированно. Состояние в памяти инстанса (на Vercel — на каждую функцию отдельно);
 * при подключённом Upstash его можно вынести в Redis тем же интерфейсом.
 */
export class CircuitBreaker {
  private openUntil = 0;

  constructor(
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  isOpen(): boolean {
    return this.now() < this.openUntil;
  }

  trip(): void {
    this.openUntil = this.now() + this.cooldownMs;
  }

  reset(): void {
    this.openUntil = 0;
  }
}
