import { Box, Gauge, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

const features: { key: 'compat' | 'threeD' | 'fps' | 'ai'; icon: LucideIcon }[] = [
  { key: 'compat', icon: ShieldCheck },
  { key: 'threeD', icon: Box },
  { key: 'fps', icon: Gauge },
  { key: 'ai', icon: Sparkles },
];

export function Features() {
  const t = useTranslations('home.features');

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ key, icon: Icon }) => (
          <article
            key={key}
            className="group relative overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-6 shadow-panel transition-[border-color,transform,box-shadow] duration-300 ease-speed hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow-lg"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-cta transition-transform duration-500 ease-speed group-hover:scale-x-100"
            />
            <span className="inline-flex size-11 items-center justify-center rounded-lg border border-brand/30 bg-brand-deep text-brand-bright">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-5 text-base font-semibold">{t(`${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-steel-300">{t(`${key}.text`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
