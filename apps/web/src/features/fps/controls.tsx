'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-graphite-700 bg-graphite-900 px-2 text-sm';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 space-y-1 text-xs text-steel-300">
      <span className="block font-semibold tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}

/** Сегментированный выбор: разрешение и пресет — 3–4 варианта, кнопками удобнее списка. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
  testId,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  render: (v: T) => string;
  testId: string;
}) {
  return (
    <div className="min-w-0 space-y-1 text-xs text-steel-300">
      <span className="block font-semibold tracking-wide uppercase">{label}</span>
      <div
        className="flex rounded-md border border-graphite-700 p-0.5"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            data-testid={`${testId}-${option}`}
            onClick={() => onChange(option)}
            className={cn(
              'flex-1 rounded px-2 py-1.5 text-xs font-semibold transition-colors',
              value === option ? 'bg-brand text-white' : 'text-steel-300 hover:text-white',
            )}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
