import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ConfiguratorVideo } from './configurator-video';
import { Reveal } from '@/components/motion/reveal';
import { homeSection } from './section-header';

const points = ['animation', 'explore', 'compat', 'share'] as const;

/** Секция главной про 3D-конфигуратор: текст слева, видео в окне справа. */
export function ConfiguratorShowcase() {
  const t = useTranslations('home.configurator');

  return (
    <section className={homeSection}>
      <Reveal
        stagger
        className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[1fr_1.15fr] lg:gap-12"
      >
        <div className="space-y-4 lg:space-y-6">
          <p className="inline-flex rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 label-caps text-brand-bright shadow-glow-sm">
            {t('eyebrow')}
          </p>
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {t('title')}
          </h2>
          <p className="max-w-xl leading-relaxed text-pretty text-steel-300">{t('text')}</p>
          <ul className="space-y-2 sm:space-y-3">
            {points.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm text-foreground sm:text-base">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-deep text-brand-bright">
                  <CheckIcon className="size-3.5" />
                </span>
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
          <Button asChild size="lg">
            <Link href="/configurator">
              {t('cta')}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>

        {/* На телефоне видео — над текстом */}
        <div className="relative order-first lg:order-none">
          {/* Свечение не шире боковых отступов, иначе на телефоне появляется прокрутка вбок */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[2rem] bg-brand/20 blur-3xl sm:-inset-6"
          />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-graphite-950 shadow-panel">
            <ConfiguratorVideo />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
