import { getDb } from '@redcore/db';
import { formatDate, formatPrice, htmlLangs, isLocale, type Locale } from '@redcore/i18n';
import { trackEvent } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { after, type NextRequest } from 'next/server';
import { absoluteUrl } from '@/lib/seo';
import { renderBuildPdf } from '@/server/build-pdf';
import { loadSavedBuild } from '@/server/builds';

export const runtime = 'nodejs';

type CompatKey = Parameters<Awaited<ReturnType<typeof getTranslations<'compat'>>>>[0];

/** Спецификация сохранённой сборки в PDF (RU/UZ): /api/builds/<publicId>/pdf?locale=uz */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/api/builds/[publicId]/pdf'>,
) {
  const { publicId } = await params;
  const requested = request.nextUrl.searchParams.get('locale');
  const locale: Locale = requested && isLocale(requested) ? requested : 'ru';
  const saved = await loadSavedBuild(locale, publicId);
  if (!saved) return new Response('Not found', { status: 404 });

  const [t, tc, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: 'configurator' }),
    getTranslations({ locale, namespace: 'compat' }),
    getTranslations({ locale, namespace: 'compat.status' }),
  ]);
  const price = (amount: number) => formatPrice(amount, locale);
  const now = new Date();

  const pdf = await renderBuildPdf({
    lang: htmlLangs[locale],
    title: saved.name ? t('share.namedTitle', { name: saved.name }) : t('pdf.title'),
    subtitle: `${publicId} · ${t('share.savedAt', { date: formatDate(saved.createdAt, locale) })}`,
    generated: t('pdf.generated', {
      date: formatDate(now, locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }),
    columns: {
      slot: t('pdf.colSlot'),
      item: t('pdf.colItem'),
      qty: t('pdf.colQty'),
      price: t('pdf.colPrice'),
      sum: t('pdf.colSum'),
    },
    lines: saved.lines.map((line) => ({
      slot: t(`slots.${line.slot}`),
      name: `${line.product.brand} ${line.product.name}`,
      sku: line.product.sku,
      qty: line.qty,
      price: price(line.product.priceUzs),
      sum: price(line.product.priceUzs * line.qty),
    })),
    totalLabel: t('summary.total'),
    total: price(saved.check.totalUzs),
    statusLabel: t('pdf.status'),
    status: tStatus(saved.check.status),
    issues: saved.check.issues.map((issue) => ({
      severity: issue.severity,
      text: tc(issue.code as CompatKey, issue.params ?? {}),
    })),
    power: t('pdf.power', {
      load: saved.check.power.loadW,
      recommended: saved.check.power.recommendedPsuW,
    }),
    link: t('pdf.link', { url: absoluteUrl(`/${locale}/b/${publicId}`) }),
    disclaimer: t('pdf.disclaimer'),
  });

  after(async () => {
    try {
      await trackEvent(await getDb(), 'build_pdf', { publicId, locale });
    } catch {
      /* аналитика не должна ломать выдачу файла */
    }
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="redcore-build-${publicId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
