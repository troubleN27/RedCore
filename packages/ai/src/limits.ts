import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Лимиты сообщений (план, §8): гость — 20 за 10 минут по IP, пользователь — 60.
// С Upstash лимит общий для всех инстансов Vercel; без него — скользящее окно в памяти.

export interface RateLimiter {
  limit(key: string, max: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  async limit(key: string, max: number, windowMs: number) {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: windowMs - (now - recent[0]!) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Не даём карте расти бесконечно
    if (this.hits.size > 10_000)
      for (const k of [...this.hits.keys()].slice(0, 1000)) this.hits.delete(k);
    return { ok: true, retryAfterMs: 0 };
  }
}

export class UpstashRateLimiter implements RateLimiter {
  private readonly cache = new Map<string, Ratelimit>();

  constructor(private readonly redis: Redis) {}

  async limit(key: string, max: number, windowMs: number) {
    const id = `${max}:${windowMs}`;
    let limiter = this.cache.get(id);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(max, `${Math.round(windowMs / 1000)} s`),
        prefix: 'redcore:ai',
      });
      this.cache.set(id, limiter);
    }
    const result = await limiter.limit(key);
    return { ok: result.success, retryAfterMs: Math.max(0, result.reset - Date.now()) };
  }
}

export function rateLimiterFromEnv(
  env: Record<string, string | undefined> = process.env,
): RateLimiter {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRateLimiter(
      new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
    );
  }
  return new MemoryRateLimiter();
}
