/**
 * Секретный путь админ-панели. В продакшене берётся только из ADMIN_BASE_PATH (без него
 * консоль недоступна); в разработке и CI — запасной путь, чтобы работали тесты.
 */
export function adminBasePath(): string | null {
  const value = process.env.ADMIN_BASE_PATH?.trim();
  if (value && /^\/[a-z0-9-]{6,}$/.test(value) && value !== '/admin') return value;
  return process.env.NODE_ENV !== 'production' || process.env.CI ? '/ops-console-dev' : null;
}

/** Внутренний сегмент маршрута консоли — снаружи по нему не попасть (proxy отдаёт 404). */
export const CONSOLE_SEGMENT = 'console';
/** Заголовок, которым proxy помечает запрос, пришедший через секретный путь. */
export const CONSOLE_HEADER = 'x-redcore-console';
