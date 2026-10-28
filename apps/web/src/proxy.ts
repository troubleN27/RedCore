import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { adminBasePath, CONSOLE_HEADER, CONSOLE_SEGMENT } from './lib/admin-path';

const intl = createMiddleware(routing);
const consolePath = new RegExp(`^/(${routing.locales.join('|')})/${CONSOLE_SEGMENT}(/|$)`);

/**
 * Локализация витрины и скрытая админка: /<ADMIN_BASE_PATH>/… переписывается во
 * внутренний /<locale>/console/…, а прямой адрес консоли отдаёт обычную 404.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const base = adminBasePath();

  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    const locale = routing.locales.find((l) => l === cookieLocale) ?? routing.defaultLocale;
    const rest = pathname.slice(base.length);
    const url = new URL(`/${locale}/${CONSOLE_SEGMENT}${rest}${search}`, request.url);
    const headers = new Headers(request.headers);
    headers.set(CONSOLE_HEADER, base);
    const response = NextResponse.rewrite(url, { request: { headers } });
    // Консоль не должна попадать ни в поиск, ни в кэш общих прокси
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  if (consolePath.test(pathname)) {
    // Внутренний путь снаружи не существует: показываем ту же 404, что и для любого мусора
    return NextResponse.rewrite(new URL(`/${routing.defaultLocale}/__not-found`, request.url));
  }

  return intl(request);
}

export const config = {
  // Всё, кроме API, служебных путей Next/Vercel и файлов с расширением
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
