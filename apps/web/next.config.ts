import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Единый .env.local лежит в корне монорепо — его же читают скрипты БД и MCP.
loadEnvConfig(path.resolve(process.cwd(), '../..'), process.env.NODE_ENV !== 'production');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';
const r2Public = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).origin : '';

/**
 * CSP без nonce: nonce сделал бы каждую страницу динамической (каталог и карточки товаров
 * пререндерятся ради скорости). Inline-скрипты Next разрешены, всё остальное — по списку:
 * Stripe (Payment Element, 3-D Secure), обложки игр со Steam CDN, свои GLB и картинки в R2.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://cdn.cloudflare.steamstatic.com https://*.stripe.com ${r2Public}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.r2.cloudflarestorage.com ${r2Public}${isDev ? ' ws: wss:' : ''}`.trim(),
  'frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), usb=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: [
    '@redcore/ai',
    '@redcore/db',
    '@redcore/domain',
    '@redcore/i18n',
    '@redcore/mcp',
    '@redcore/services',
  ],
  // PGlite (локальная БД без Neon) грузит WASM с диска — его нельзя бандлить
  // @react-pdf/renderer тянет fontkit/yoga с WASM — тоже оставляем внешним
  serverExternalPackages: ['@electric-sql/pglite', 'pg', '@react-pdf/renderer'],
  // Шрифты для PDF и OG-картинок читаются с диска — включаем их в серверные функции Vercel
  outputFileTracingIncludes: {
    '/api/builds/[publicId]/pdf': ['./assets/fonts/**'],
    '/[locale]/b/[publicId]/opengraph-image': ['./assets/fonts/**'],
  },
};

export default withNextIntl(nextConfig);
