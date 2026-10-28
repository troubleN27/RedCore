import type { SpecRow } from './spec-format';

export function SpecTable({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900/60">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 px-4 py-2.5 text-sm"
        >
          <dt className="text-steel-300">{row.label}</dt>
          <dd className="font-medium break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
