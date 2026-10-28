import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';

// Регистрация и вход (покупателя и персонала) и операции admin-плагина — только из server
// actions: там проверка телефона и пароля, блокировка после 5 ошибок и аудит. По HTTP их нет.
const internalOnly = [/^\/api\/auth\/sign-(in|up)\//, /^\/api\/auth\/admin\//];

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
