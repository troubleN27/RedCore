'use client';

import { useLayoutEffect, useRef } from 'react';

type RevealTag = 'div' | 'section' | 'ul' | 'ol' | 'header';

/** Сколько первых дочерних элементов получают нарастающую задержку — дальше одинаковая */
const MAX_STAGGER = 8;

/**
 * Плавное появление при прокрутке: блок один раз «всплывает» снизу, когда доходит до экрана.
 * stagger — появляются по очереди прямые дочерние элементы (карточки в сетке).
 * Стили — в globals.css ([data-reveal]). Прятать контент начинает только этот скрипт:
 * без JS и при «уменьшении движения» всё видно сразу; то, что уже на экране при загрузке,
 * показывается без анимации.
 */
export function Reveal({
  as: Tag = 'div',
  stagger = false,
  children,
  ...props
}: {
  as?: RevealTag;
  stagger?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stagger) {
      [...el.children].forEach((child, i) =>
        (child as HTMLElement).style.setProperty('--reveal-i', String(Math.min(i, MAX_STAGGER))),
      );
    }
    const show = (mode: 'in' | 'instant') => el.setAttribute('data-revealed', mode);
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      show('instant');
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          show('in');
          observer.disconnect();
        },
        { rootMargin: '0px 0px -10% 0px' },
      );
      observer.observe(el);
      document.documentElement.classList.add('reveal-on');
      return () => observer.disconnect();
    }
    document.documentElement.classList.add('reveal-on');
  }, [stagger]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      {...(stagger ? { 'data-reveal-stagger': '' } : { 'data-reveal': '' })}
      {...props}
    >
      {children}
    </Tag>
  );
}
