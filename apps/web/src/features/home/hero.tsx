import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { OpenChatButton } from '@/features/chat/open-chat-button';
import { Link } from '@/i18n/navigation';
import { HeroVideo } from './hero-video';

export function Hero() {
  const t = useTranslations('home.hero');

  return (
    <section className="relative isolate overflow-hidden">
      {/* Телефоны: текстура карбона под видео — видна, пока оно грузится или выключено */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-30 bg-carbon [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-60 md:hidden"
      />
      <HeroVideo />
      {/* Затемнение видео: текст и кнопки читаемы, низ плавно уходит в фон страницы */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-linear-to-b from-black/70 via-black/60 to-background"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-hero-glow" />
      {/* «Скоростные» линии */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <span className="absolute top-[22%] left-0 h-px w-1/4 animate-speed-line bg-linear-to-r from-transparent via-brand-bright/70 to-transparent" />
        <span className="absolute top-[58%] left-0 h-px w-1/3 animate-speed-line bg-linear-to-r from-transparent via-brand/60 to-transparent [animation-delay:1.1s]" />
        <span className="absolute top-[80%] left-0 h-px w-1/5 animate-speed-line bg-linear-to-r from-transparent via-white/30 to-transparent [animation-delay:2s]" />
      </div>

      {/* Высота с запасом под видео: на широких экранах — почти весь первый экран, но не выше 700 px */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] content-center px-4 pt-16 pb-20 sm:px-6 md:min-h-[560px] md:pt-20 lg:min-h-[min(640px,calc(100svh-4rem))] lg:px-8 lg:pb-24">
        <div className="animate-fade-up space-y-7">
          <p className="inline-flex rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 label-caps text-brand-bright shadow-glow-sm backdrop-blur-sm">
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
              <Link href="/catalog">
                {t('ctaPrimary')}
                <ArrowRightIcon />
              </Link>
            </Button>
            <OpenChatButton>{t('ctaSecondary')}</OpenChatButton>
          </div>
        </div>
      </div>
    </section>
  );
}
