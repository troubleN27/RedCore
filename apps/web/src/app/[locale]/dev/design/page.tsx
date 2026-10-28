import { formatPrice, locales } from '@redcore/i18n';
import { CheckCircle2Icon, SearchIcon, XCircleIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import { PriceTag } from '@/components/brand/price-tag';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

export const metadata: Metadata = { robots: { index: false, follow: false } };

const palette = [
  { token: '--rc-black', hex: '#0A0A0B', key: 'bg' },
  { token: '--rc-graphite-900', hex: '#16161A', key: 'surface' },
  { token: '--rc-graphite-800', hex: '#2A2A31', key: 'border' },
  { token: '--rc-white', hex: '#F5F5F7', key: 'text' },
  { token: '--rc-steel-300', hex: '#A1A1AA', key: 'muted' },
  { token: '--rc-red-500', hex: '#D40000', key: 'red500' },
  { token: '--rc-red-400', hex: '#FF2800', key: 'red400' },
  { token: '--rc-red-900', hex: '#2A0000', key: 'red900' },
  { token: '--rc-metal', hex: '#C9CCD1', key: 'metal' },
  { token: '--rc-success', hex: '#2BD47D', key: 'success' },
  { token: '--rc-warning', hex: '#F6C700', key: 'warning' },
  { token: '--rc-danger', hex: '#FF453A', key: 'danger' },
  { token: '--rc-info', hex: '#4C8DFF', key: 'info' },
] as const;

const typeScale = ['text-6xl', 'text-5xl', 'text-4xl', 'text-3xl', 'text-2xl'] as const;
const fontFamilies = ['font-display', 'font-sans', 'font-mono'] as const;
const specSample = 'LGA1851 · DDR5-6400 · PCIe 5.0 x16 · 12V-2x6';
const sampleProduct = {
  name: 'MSI GeForce RTX 5070 Ti Gaming Trio OC',
  price: 11_490_000,
  old: 12_290_000,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-graphite-800 pt-10">
      <h2 className="label-caps text-brand-bright">{title}</h2>
      {children}
    </section>
  );
}

// Живой стайлгайд дизайн-системы. В продакшене недоступен.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const t = useTranslations('dev');
  const tc = useTranslations('common');
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-14 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="max-w-2xl text-steel-300">{t('subtitle')}</p>
      </header>

      <Section title={t('sections.palette')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {palette.map((swatch) => (
            <div
              key={swatch.token}
              className="overflow-hidden rounded-lg border border-graphite-800"
            >
              <div className="h-20" style={{ background: `var(${swatch.token})` }} />
              <div className="space-y-0.5 bg-graphite-950 p-3">
                <p className="text-sm font-medium">{t(`palette.${swatch.key}`)}</p>
                <p className="font-mono text-xs text-steel-400">
                  {`${swatch.token} · ${swatch.hex}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('sections.typography')}>
        <div className="space-y-4">
          <p className="label-caps text-steel-400">{t('typography.display')}</p>
          {typeScale.map((size) => (
            <p key={size} className={`font-display font-bold tracking-tight ${size}`}>
              {t('typography.sample')}
            </p>
          ))}
          <p className="pt-4 label-caps text-steel-400">{t('typography.body')}</p>
          <p className="max-w-2xl text-lg text-steel-300">{t('typography.paragraph')}</p>
          <p className="pt-4 label-caps text-steel-400">{t('typography.mono')}</p>
          <p className="font-mono text-sm text-metal">{specSample}</p>
        </div>
      </Section>

      <Section title={t('sections.buttons')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t('buttons.primary')}</Button>
          <Button variant="secondary">{t('buttons.secondary')}</Button>
          <Button variant="outline">{t('buttons.outline')}</Button>
          <Button variant="ghost">{t('buttons.ghost')}</Button>
          <Button variant="destructive">{t('buttons.destructive')}</Button>
          <Button disabled>{t('buttons.disabled')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{t('buttons.small')}</Button>
          <Button size="lg">{t('buttons.large')}</Button>
          <Button size="icon" variant="outline" aria-label={tc('actions.search')}>
            <SearchIcon />
          </Button>
        </div>
      </Section>

      <Section title={t('sections.badges')}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="solid">{tc('badges.hit')}</Badge>
          <Badge>{tc('badges.new')}</Badge>
          <Badge variant="metal">{tc('badges.sale')}</Badge>
          <Badge variant="success">
            <CheckCircle2Icon />
            {tc('badges.compatible')}
          </Badge>
          <Badge variant="danger">
            <XCircleIcon />
            {tc('badges.incompatible')}
          </Badge>
          <Badge variant="success">{tc('stock.inStock')}</Badge>
          <Badge variant="warning">{tc('stock.lowStock', { count: 3 })}</Badge>
          <Badge variant="secondary">{tc('stock.outOfStock')}</Badge>
          <Badge variant="info">{tc('badges.estimate')}</Badge>
        </div>
      </Section>

      <Section title={t('sections.cards')}>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="group relative overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow-lg">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-y-100"
            />
            <p className="label-caps text-steel-400">{t('cards.productTitle')}</p>
            <h3 className="mt-2 font-medium">{sampleProduct.name}</h3>
            <p className="mt-1 text-sm text-steel-300">{t('cards.productText')}</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <PriceTag amount={sampleProduct.price} compareAt={sampleProduct.old} size="sm" />
              <Button size="sm">{tc('actions.addToCart')}</Button>
            </div>
          </article>
          <article className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 shadow-panel">
            <p className="label-caps text-steel-400">{t('cards.statLabel')}</p>
            <p className="mt-3 font-display text-3xl font-bold tabular-nums">
              {formatPrice(14_820_000, locale)}
            </p>
            <p className="mt-2 text-sm text-success">{t('cards.statDelta')}</p>
          </article>
          <article className="rounded-xl border border-graphite-800 bg-carbon p-5">
            <p className="label-caps text-steel-400">{t('motion.glow')}</p>
            <div className="mt-4 h-16 animate-glow-pulse rounded-lg border border-brand/40 bg-brand-deep" />
          </article>
        </div>
      </Section>

      <Section title={t('sections.forms')}>
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dev-search">{t('forms.searchLabel')}</Label>
            <Input id="dev-search" type="search" placeholder={t('forms.searchPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-phone">{t('forms.phoneLabel')}</Label>
            <Input id="dev-phone" type="tel" inputMode="tel" defaultValue="+998 " />
            <p className="text-xs text-steel-400">{t('forms.phoneHint')}</p>
          </div>
        </div>
      </Section>

      <Section title={t('sections.prices')}>
        <div className="grid gap-6 sm:grid-cols-2">
          {locales.map((locale) => (
            <div
              key={locale}
              className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-950 p-5"
            >
              <p className="font-mono text-xs text-steel-400">{locale}</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatPrice(12_450_000, locale)}
              </p>
              <p className="text-steel-300 tabular-nums">{formatPrice(890_000, locale)}</p>
            </div>
          ))}
        </div>
        <PriceTag amount={24_990_000} compareAt={27_490_000} size="lg" />
      </Section>

      <Section title={t('sections.motion')}>
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm text-steel-300">{t('motion.shine')}</p>
            <Button size="lg">{tc('actions.buildPc')}</Button>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-steel-300">{t('motion.progress')}</p>
            <Progress value={72} aria-label={t('motion.progress')} />
          </div>
        </div>
      </Section>

      <Section title={t('sections.glyphs')}>
        <div className="space-y-4">
          {fontFamilies.map((font) => (
            <div key={font} className={`${font} space-y-1`}>
              <p className="text-2xl">{t('glyphs.uz')}</p>
              <p className="text-lg text-steel-300">{t('glyphs.ru')}</p>
              <p className="text-sm text-steel-400 tabular-nums">{t('glyphs.digits')}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
