import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export const statKeys = ['years', 'builds', 'clients', 'regions'] as const;

/** Цифры компании (демо): на главной — первые три, на странице «О компании» — все. */
export function Stats({
  keys = statKeys,
  className,
}: {
  keys?: readonly (typeof statKeys)[number][];
  className?: string;
}) {
  const t = useTranslations('about.stats');

  return (
    <dl className={cn('grid gap-3', className)}>
      {keys.map((key) => (
        // Подпись (dt) идёт в разметке первой, но на экране — под цифрой
        <div
          key={key}
          className="flex flex-col-reverse justify-end gap-1 rounded-xl border border-graphite-800 bg-graphite-900/80 p-2.5 min-[360px]:p-3 sm:p-4"
        >
          <dt className="text-xs text-steel-300">{t(`${key}.label`)}</dt>
          <dd className="font-display text-sm font-bold whitespace-nowrap text-brand-bright min-[360px]:text-base min-[400px]:text-lg sm:text-2xl">
            {t(`${key}.value`)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
