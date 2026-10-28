import 'server-only';
import { geminiFromEnv, rateLimiterFromEnv, type LlmGateway, type RateLimiter } from '@redcore/ai';
import { env } from '@/env';

// Шлюз Gemini и лимитер — по одному на инстанс: circuit breaker и окно лимитов живут между
// запросами.

let gateway: LlmGateway | undefined;
let limiter: RateLimiter | undefined;

export function getGateway(): LlmGateway {
  gateway ??= geminiFromEnv({
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GEMINI_MODEL_CHAT: env.GEMINI_MODEL_CHAT,
    GEMINI_MODEL_POWER: env.GEMINI_MODEL_POWER,
    GEMINI_MODEL_LITE: env.GEMINI_MODEL_LITE,
  });
  return gateway;
}

export function getLimiter(): RateLimiter {
  limiter ??= rateLimiterFromEnv({
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return limiter;
}
