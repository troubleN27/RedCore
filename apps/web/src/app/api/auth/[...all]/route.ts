import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';

// Вход персонала (пароль, 2FA) и операции admin-плагина доступны только из server actions
// админ-панели: там стоит своя блокировка после 5 ошибок и аудит. По HTTP их нет.
const internalOnly = [
  /^\/api\/auth\/sign-(in|up)\/email/,
  /^\/api\/auth\/two-factor\//,
  /^\/api\/auth\/admin\//,
];

function blocked(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return internalOnly.some((pattern) => pattern.test(pathname));
}

export async function GET(request: Request) {
  if (blocked(request)) return new Response('Not found', { status: 404 });
  return toNextJsHandler(await getAuth()).GET(request);
}

export async function POST(request: Request) {
  if (blocked(request)) return new Response('Not found', { status: 404 });
  return toNextJsHandler(await getAuth()).POST(request);
}
