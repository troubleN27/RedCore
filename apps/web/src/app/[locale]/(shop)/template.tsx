import type { ReactNode } from 'react';

/**
 * Шаблон пересоздаётся на каждую навигацию — содержимое страницы плавно проявляется
 * (220 мс, кривая «скорости» из дизайн-системы). При prefers-reduced-motion анимации нет.
 */
export default function ShopTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
