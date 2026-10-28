'use client';

import { htmlLangs, localeNames, locales, localeShortNames, type Locale } from '@redcore/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Переключатель RU / UZ. Выбор сохраняется next-intl в cookie NEXT_LOCALE на год. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next, scroll: false });
    });
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn(
        'inline-flex items-center rounded-md border border-graphite-800 bg-graphite-950 p-0.5',
        isPending && 'opacity-70',
        className,
      )}
    >
      {locales.map((item) => {
        const isActive = item === locale;
        return (
          <button
            key={item}
            type="button"
            lang={htmlLangs[item]}
            title={localeNames[item]}
            aria-pressed={isActive}
            disabled={isPending}
            onClick={() => switchTo(item)}
            className={cn(
              'h-7 min-w-9 rounded px-2 text-xs font-semibold tracking-wider transition-[background-color,color,box-shadow] duration-200 ease-speed',
              isActive
                ? 'bg-brand text-white shadow-glow-sm'
                : 'text-steel-300 hover:bg-white/5 hover:text-foreground',
            )}
          >
            {localeShortNames[item]}
          </button>
        );
      })}
    </div>
  );
}
