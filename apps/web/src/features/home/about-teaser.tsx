import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ShowroomPhoto } from '@/features/about/showroom-photo';
import { Stats } from '@/features/about/stats';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/motion/reveal';
import { homeSection } from './section-header';

const teaserStats = ['years', 'builds', 'clients'] as const;

/** Секция главной «О компании»: фото шоурума слева, коротко о магазине и ссылка на /about. */
export function AboutTeaser() {
  const t = useTranslations('about.teaser');

  return (
    <section className={homeSection}>
      <Reveal
        stagger
        className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12"
      >
        <ShowroomPhoto alt={t('photoAlt')} sizes="(min-width: 1024px) 640px, calc(100vw - 32px)" />
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 label-caps text-brand-bright shadow-glow-sm">
            {t('eyebrow')}
          </p>
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {t('title')}
          </h2>
          <p className="max-w-xl leading-relaxed text-pretty text-steel-300">{t('text')}</p>
          <Stats keys={teaserStats} className="grid-cols-3" />
          <Button asChild size="lg">
            <Link href="/about">
              {t('more')}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
