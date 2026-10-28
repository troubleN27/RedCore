'use client';

import type { ComponentType } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { LayoutGridIcon, Loader2Icon, SearchIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { componentIcons } from '@/components/brand/product-art';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface Suggestion {
  total: number;
  categories: { slug: string; name: string; count: number }[];
  items: {
    slug: string;
    name: string;
    brand: string;
    componentType: ComponentType;
    priceUzs: number;
    available: number;
  }[];
}

type Option =
  | { kind: 'category'; href: string; label: string }
  | { kind: 'product'; href: string; item: Suggestion['items'][number] }
  | { kind: 'all'; href: string };

const DEBOUNCE_MS = 150;
const OPTION_ROLE = 'option';

/** Поиск с автодополнением: стрелки, Enter, Esc; Enter без выбора — страница результатов. */
export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const t = useTranslations('shop.search');
  const locale = useLocale();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    // Короткий запрос не ищем; старые подсказки просто скрываются (см. hasQuery)
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const response = await fetch(`/api/search?locale=${locale}&q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        setData((await response.json()) as Suggestion);
        setActive(-1);
      } catch {
        /* запрос отменён следующим вводом */
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, locale]);

  const searchHref = `/search?q=${encodeURIComponent(query.trim())}`;
  const hasQuery = query.trim().length >= 2;
  const options: Option[] =
    data && hasQuery
      ? [
          ...data.categories.map((c) => ({
            kind: 'category' as const,
            href: `/catalog/${c.slug}`,
            label: c.name,
          })),
          ...data.items.map((item) => ({
            kind: 'product' as const,
            href: `/p/${item.slug}`,
            item,
          })),
          ...(data.total > data.items.length ? [{ kind: 'all' as const, href: searchHref }] : []),
        ]
      : [];

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[active];
      if (option) go(option.href);
      else if (query.trim().length > 0) go(searchHref);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && hasQuery && data !== null;

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400"
        />
        <input
          type="search"
          role="combobox"
          aria-label={t('label')}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={query}
          placeholder={t('placeholder')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-md border border-graphite-800 bg-graphite-950/80 pr-9 pl-9 text-sm outline-none placeholder:text-steel-400 focus-visible:border-brand-bright/60 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        {loading && (
          <Loader2Icon
            aria-hidden="true"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-steel-400"
          />
        )}
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-graphite-800 bg-popover shadow-panel"
        >
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-steel-300">
              {t('nothing', { query: query.trim() })}
            </p>
          ) : (
            options.map((option, index) => {
              const selected = index === active;
              const common = {
                id: `${listId}-${index}`,
                role: OPTION_ROLE,
                'aria-selected': selected,
                onMouseDown: (e: React.MouseEvent) => {
                  e.preventDefault();
                  go(option.href);
                },
                onMouseEnter: () => setActive(index),
                className: cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                  selected && 'bg-white/5',
                ),
              };
              if (option.kind === 'category') {
                return (
                  <div key={option.href} {...common}>
                    <LayoutGridIcon className="size-4 text-brand-bright" />
                    <span className="flex-1">{option.label}</span>
                    <span className="label-caps text-steel-400">{t('categories')}</span>
                  </div>
                );
              }
              if (option.kind === 'all') {
                return (
                  <div key="all" {...common}>
                    <SearchIcon className="size-4 text-brand-bright" />
                    <span className="flex-1 text-brand-bright">
                      {t('showAll', { count: data!.total })}
                    </span>
                  </div>
                );
              }
              const Icon = componentIcons[option.item.componentType];
              return (
                <div key={option.href} {...common}>
                  <Icon className="size-4 shrink-0 text-metal" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-steel-400">{option.item.brand} </span>
                    {option.item.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-medium tabular-nums',
                      option.item.available <= 0 && 'text-steel-400',
                    )}
                  >
                    {formatPrice(option.item.priceUzs, locale)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
