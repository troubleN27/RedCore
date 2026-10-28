import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ConsoleLink } from './console-base';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'space-y-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4',
        className,
      )}
    >
      {title && <h2 className="text-sm font-semibold text-steel-300">{title}</h2>}
      {children}
    </section>
  );
}

/** Простая таблица консоли: на телефоне прокручивается по горизонтали внутри панели. */
export function DataTable({
  columns,
  rows,
  empty,
  testId,
}: {
  columns: { key: string; label: string; align?: 'right' }[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
  empty: string;
  testId?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-steel-400">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-graphite-800">
      <table className="w-full min-w-[40rem] text-sm" data-testid={testId}>
        <thead className="bg-graphite-900 text-left text-xs text-steel-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('px-3 py-2 font-medium', c.align === 'right' && 'text-right')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-white/[0.02]">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-2 align-top',
                    c.align === 'right' && 'text-right tabular-nums',
                  )}
                >
                  {row.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({
  page,
  pages,
  basePath,
  query,
  labels,
}: {
  page: number;
  pages: number;
  basePath: string;
  query: Record<string, string | undefined>;
  labels: { prev: string; next: string; page: string };
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams(
      Object.entries({ ...query, page: String(p) }).filter(([, v]) => v) as [string, string][],
    );
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <ConsoleLink href={href(page - 1)} className="text-brand-bright hover:underline">
          {labels.prev}
        </ConsoleLink>
      ) : (
        <span />
      )}
      <span className="text-steel-400">{labels.page}</span>
      {page < pages ? (
        <ConsoleLink href={href(page + 1)} className="text-brand-bright hover:underline">
          {labels.next}
        </ConsoleLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function SearchForm({
  name = 'q',
  value,
  placeholder,
  extra,
}: {
  name?: string;
  value?: string;
  placeholder: string;
  extra?: ReactNode;
}) {
  return (
    <form method="get" className="flex flex-wrap gap-2">
      <input
        type="search"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 min-w-56 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
      />
      {extra}
    </form>
  );
}
