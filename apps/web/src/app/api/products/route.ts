import { isLocale } from '@redcore/i18n';
import { getProductsBySlugs } from '@redcore/services';
import { NextResponse, type NextRequest } from 'next/server';
import { getChipNames, getSnapshot } from '@/server/catalog';

const MAX_SLUGS = 50;

// Товары по списку slug — для сравнения и избранного (их состав хранится в браузере).
export async function GET(request: NextRequest) {
  const slugs = (request.nextUrl.searchParams.get('slugs') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SLUGS);
  const localeParam = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(localeParam) ? localeParam : 'ru';
  const [snapshot, chipNames] = await Promise.all([getSnapshot(locale), getChipNames()]);

  const products = getProductsBySlugs(snapshot, slugs).map(
    ({ searchText: _searchText, ...rest }) => rest,
  );
  return NextResponse.json({ products, chipNames });
}
