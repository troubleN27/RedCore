import { isLocale } from '@redcore/i18n';
import { searchCatalog } from '@redcore/services';
import { NextResponse, type NextRequest } from 'next/server';
import { getSnapshot } from '@/server/catalog';

// Автодополнение поиска в шапке: короткий ответ, только нужные поля.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 100);
  const localeParam = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(localeParam) ? localeParam : 'ru';
  const snapshot = await getSnapshot(locale);
  const result = searchCatalog(snapshot, q, 6);

  return NextResponse.json(
    {
      total: result.total,
      categories: result.categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: c.productCount,
      })),
      items: result.items.map((p) => ({
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        componentType: p.componentType,
        priceUzs: p.priceUzs,
        available: p.available,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } },
  );
}
