import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export function Hero({ buildCard }: { buildCard?: React.ReactNode }) {
  const t = useTranslations('home.hero');

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-hero-glow" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-carbon [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-60"
      />
      {/* «Скоростные» линии */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <span className="absolute top-[22%] left-0 h-px w-1/4 animate-speed-line bg-linear-to-r from-transparent via-brand-bright/70 to-transparent" />
        <span className="absolute top-[58%] left-0 h-px w-1/3 animate-speed-line bg-linear-to-r from-transparent via-brand/60 to-transparent [animation-delay:1.1s]" />
        <span className="absolute top-[80%] left-0 h-px w-1/5 animate-speed-line bg-linear-to-r from-transparent via-white/30 to-transparent [animation-delay:2s]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 md:pt-24 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pb-28">
        <div className="animate-fade-up space-y-7">
          <p className="inline-flex items-center gap-3 label-caps text-brand-bright">
            <span aria-hidden="true" className="h-px w-10 bg-brand-bright shadow-glow-sm" />
            {t('eyebrow')}
          </p>
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-steel-300 sm:text-lg">
            {t('subtitle')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/configurator">
                {t('ctaPrimary')}
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/catalog">{t('ctaSecondary')}</Link>
            </Button>
          </div>
        </div>

        <div className="animate-fade-up [animation-delay:150ms]">{buildCard}</div>
      </div>
    </section>
  );
}
