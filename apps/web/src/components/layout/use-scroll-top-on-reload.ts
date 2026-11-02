'use client';

import { useEffect } from 'react';

/**
 * При обновлении страница открывается с начала, а не там, где её оставили.
 * Перед уходом со страницы браузеру запрещаем восстанавливать прокрутку, после загрузки
 * возвращаем как было: переходы «назад/вперёд» внутри сайта ведут себя по-прежнему.
 * Ссылка с якорем (#раздел) прокручивается к якорю, как обычно.
 */
export function useScrollTopOnReload() {
  useEffect(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav?.type === 'reload') {
      const anchor = window.location.hash && document.getElementById(window.location.hash.slice(1));
      if (anchor) anchor.scrollIntoView();
      else window.scrollTo(0, 0);
    }
    window.history.scrollRestoration = 'auto';

    const beforeUnload = () => {
      window.history.scrollRestoration = 'manual';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
}
