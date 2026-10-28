import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { formatPrice, isLocale, type Locale } from '@redcore/i18n';
import { getTranslations } from 'next-intl/server';
import { ImageResponse } from 'next/og';
import { loadSavedBuild } from '@/server/builds';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SHOWN_SLOTS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu'];
const statusColor = {
  ok: '#2BD47D',
  warnings: '#F6C700',
  errors: '#FF453A',
  incomplete: '#A1A1AA',
};

// Встроенный шрифт next/og без кириллицы — подключаем Inter с диска
const fontsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'assets', 'fonts');

/** Превью ссылки на сборку для мессенджеров и соцсетей: состав, статус и итог. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; publicId: string }>;
}) {
  const { locale: raw, publicId } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ru';
  const [saved, t, tStatus, regular, bold] = await Promise.all([
    loadSavedBuild(locale, publicId),
    getTranslations({ locale, namespace: 'configurator' }),
    getTranslations({ locale, namespace: 'compat.status' }),
    readFile(path.join(fontsDir, 'Inter-Regular.woff')),
    readFile(path.join(fontsDir, 'Inter-Bold.woff')),
  ]);
  const lines = (saved?.lines ?? []).filter((l) => SHOWN_SLOTS.includes(l.slot)).slice(0, 6);
  const title = saved?.name ? t('share.namedTitle', { name: saved.name }) : t('share.title');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 64,
        background: 'radial-gradient(circle at 85% 0%, rgba(212,0,0,0.45), #0A0A0B 55%)',
        color: '#F5F5F7',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>
          <span style={{ color: '#FF2800' }}>RED</span>
          <span>CORE</span>
        </div>
        {saved && (
          <div style={{ display: 'flex', fontSize: 26, color: statusColor[saved.check.status] }}>
            {tStatus(saved.check.status)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, marginTop: 40 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, gap: 10 }}>
        {lines.map((line) => (
          <div key={line.product.slug} style={{ display: 'flex', fontSize: 26 }}>
            <span style={{ color: '#A1A1AA', width: 300 }}>{t(`slots.${line.slot}`)}</span>
            <span>{`${line.product.brand} ${line.product.name}`}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: '3px solid #D40000',
          paddingTop: 24,
        }}
      >
        <span style={{ fontSize: 26, color: '#A1A1AA' }}>{t('summary.total')}</span>
        <span style={{ fontSize: 60, fontWeight: 700 }}>
          {saved ? formatPrice(saved.check.totalUzs, locale) : ''}
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}
