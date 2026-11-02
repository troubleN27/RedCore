'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Промокод акции с кнопкой копирования. */
export function PromoCodeCopy({ code }: { code: string }) {
  const t = useTranslations('home.promos');
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('copied', { code }));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен — код виден и его можно выделить */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-brand/40 bg-brand/5 py-1.5 pr-1.5 pl-4">
      <span className="font-mono text-sm font-semibold tracking-wider text-foreground select-all">
        {code}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={t('copyLabel', { code })}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
          copied
            ? 'bg-success/15 text-success'
            : 'bg-white/5 text-foreground hover:bg-brand hover:text-white',
        )}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        {copied ? t('copiedShort') : t('copy')}
      </button>
    </div>
  );
}
