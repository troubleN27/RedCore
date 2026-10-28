import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Переменные окружения проверяются при старте. Все интеграции, кроме сайта,
// опциональны: без ключей соответствующие фичи аккуратно отключаются.
export const env = createEnv({
  server: {
    DATABASE_URL: z.url().optional(),
    ADMIN_BASE_PATH: z
      .string()
      .regex(/^\/[a-z0-9-]{6,}$/, 'ADMIN_BASE_PATH: /lowercase-path, минимум 6 символов')
      .refine((value) => value !== '/admin', 'ADMIN_BASE_PATH не должен быть /admin')
      .optional(),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    PAYMENT_CHARGE_CURRENCY: z.enum(['uzs', 'usd']).default('uzs'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL_CHAT: z.string().default('gemini-3.8-flash'),
    GEMINI_MODEL_POWER: z.string().optional(),
    GEMINI_MODEL_LITE: z.string().default('gemini-3.5-flash-lite'),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_BASE_PATH: process.env.ADMIN_BASE_PATH,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PAYMENT_CHARGE_CURRENCY: process.env.PAYMENT_CHARGE_CURRENCY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL_CHAT: process.env.GEMINI_MODEL_CHAT,
    GEMINI_MODEL_POWER: process.env.GEMINI_MODEL_POWER,
    GEMINI_MODEL_LITE: process.env.GEMINI_MODEL_LITE,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
