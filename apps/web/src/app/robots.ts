import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

// Служебные и персональные страницы не индексируются. Секретный путь админки (этап 5)
// здесь намеренно не упоминается — robots.txt публичен.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/*/search', '/*/compare', '/*/favorites', '/*/cart', '/*/dev/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
