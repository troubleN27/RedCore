'use client';

import { StarIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { submitReviewAction } from '@/server/review-actions';

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const t = useTranslations('product');
  return (
    <span
      className={cn('inline-flex gap-0.5 text-warning', className)}
      role="img"
      aria-label={t('stars', { rating })}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          className={cn('size-3.5', i < Math.round(rating) ? 'fill-current' : 'opacity-30')}
        />
      ))}
    </span>
  );
}

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const t = useTranslations('product');
  const locale = useLocale();
  const { data: session } = useSession();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [pending, startTransition] = useTransition();

  if (!session) {
    return (
      <Link href={`/login?next=/p/${slug}`} className="text-sm text-brand-bright hover:underline">
        {t('reviewLogin')}
      </Link>
    );
  }
  if (state === 'sent')
    return (
      <p className="text-sm text-success" role="status">
        {t('reviewSent')}
      </p>
    );

  return (
    <form
      className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4"
      data-testid="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await submitReviewAction({ productId, locale, rating, text, pros, cons });
          setState(result.ok ? 'sent' : 'error');
        });
      }}
    >
      <h3 className="font-semibold">{t('writeReview')}</h3>
      <div className="space-y-1">
        <Label htmlFor="review-rating">{t('reviewRating')}</Label>
        <select
          id="review-rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-graphite-900 px-2 text-sm"
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {t('stars', { rating: r })}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="review-text">{t('reviewText')}</Label>
        <textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          minLength={10}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="review-pros">{t('reviewPros')}</Label>
          <Input
            id="review-pros"
            value={pros}
            onChange={(e) => setPros(e.target.value)}
            maxLength={300}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="review-cons">{t('reviewCons')}</Label>
          <Input
            id="review-cons"
            value={cons}
            onChange={(e) => setCons(e.target.value)}
            maxLength={300}
          />
        </div>
      </div>
      {state === 'error' && (
        <p className="text-sm text-danger" role="alert">
          {t('reviewError')}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={pending || text.trim().length < 10}
        data-testid="review-submit"
      >
        {t('reviewSubmit')}
      </Button>
    </form>
  );
}
