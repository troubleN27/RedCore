'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.generic');
  const tc = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <TriangleAlertIcon className="size-6" />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
      <p className="max-w-md text-steel-300">{t('text')}</p>
      <Button onClick={reset}>{tc('actions.retry')}</Button>
    </section>
  );
}
