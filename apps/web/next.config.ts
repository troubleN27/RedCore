import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Единый .env.local лежит в корне монорепо — его же читают скрипты БД и MCP.
// forceReload: Next уже вызвал loadEnvConfig для apps/web, а без флага @next/env отдаёт тот кэш.
loadEnvConfig(
  path.resolve(process.cwd(), '../..'),
  process.env.NODE_ENV !== 'production',
  console,
  true,
);

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * CSP без nonce: nonce сделал бы каждую страницу динамической (каталог и карточки товаров
 * пререндерятся ради скорости). Inline-скрипты Next разрешены, всё остальное — по списку:
 * Stripe (Payment Element, 3-D Secure) и обложки игр со Steam CDN; свои GLB отдаёт сам сайт.
 */
const csp = [
  "default-src 'self'",
  // wasm-unsafe-eval — только WebAssembly (декодер meshopt для GLB); eval для JS по-прежнему запрещён
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.cloudflare.steamstatic.com https://*.stripe.com",
  "font-src 'self' data:",
  // blob: — GLTFLoader распаковывает встроенные в GLB текстуры через blob-URL и fetch
  `connect-src 'self' blob: https://api.stripe.com https://*.stripe.com${isDev ? ' ws: wss:' : ''}`,
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
