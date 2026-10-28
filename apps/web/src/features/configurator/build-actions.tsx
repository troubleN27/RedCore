'use client';

import { CheckIcon, CopyIcon, FileDownIcon, Share2Icon, ShoppingCartIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { saveBuildAction, trackBuildEventAction } from '@/server/build-actions';
import { useShopStore } from '@/stores/shop-store';
import { pdfUrl } from './types';

export interface CartLine {
  slug: string;
  name: string;
  qty: number;
  available: number;
}

/** Вся сборка в корзину. Товары без остатка пропускаются — покупатель видит, какие. */
export function AddBuildToCartButton({
  lines,
  publicId,
  className,
}: {
  lines: CartLine[];
  publicId?: string;
  className?: string;
}) {
  const t = useTranslations('configurator.actions');
  const addToCart = useShopStore((s) => s.addToCart);

  function onClick() {
    const available = lines.filter((l) => l.available > 0);
    const skipped = lines.filter((l) => l.available <= 0);
    for (const line of available) addToCart(line.slug, Math.min(line.qty, line.available));
    if (available.length > 0) toast.success(t('addedToCart', { count: available.length }));
    if (skipped.length > 0)
      toast.warning(t('unavailableSkipped', { names: skipped.map((l) => l.name).join(', ') }));
    void trackBuildEventAction({ type: 'build_to_cart', lines: available.length, publicId });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={lines.length === 0}
      className={className}
      data-testid="build-to-cart"
    >
      <ShoppingCartIcon />
      {t('toCart')}
    </Button>
  );
}

export function CopyLinkButton({ url, publicId }: { url: string; publicId: string }) {
  const t = useTranslations('configurator.actions');
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 2000);
      void trackBuildEventAction({ type: 'build_shared', publicId });
    } catch {
      /* буфер обмена недоступен — ссылку можно выделить в поле */
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={onCopy}
      aria-label={t('copyLink')}
      title={t('copyLink')}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
    </Button>
  );
}

/**
 * Сохранение сборки и ссылка «поделиться». PDF строится по сохранённой сборке,
 * поэтому кнопка PDF сначала сохраняет текущий состав, если он ещё не сохранён.
 */
export function SaveShareActions({
  items,
  savedId,
  onSaved,
}: {
  items: { slug: string; qty: number }[];
  savedId: string | null;
  onSaved: (publicId: string) => void;
}) {
  const t = useTranslations('configurator.actions');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const empty = items.length === 0;

  async function ensureSaved(): Promise<string | null> {
    if (savedId) return savedId;
    const result = await saveBuildAction({ items });
    if (!result.ok) {
      toast.error(t('saveError'));
      return null;
    }
    onSaved(result.publicId);
    return result.publicId;
  }

  const onSave = () => startTransition(async () => void (await ensureSaved()));
  const onPdf = () =>
    startTransition(async () => {
      const id = await ensureSaved();
      if (id) window.location.assign(pdfUrl(id, locale));
    });

  const shareUrl = savedId
    ? new URL(`/${locale}/b/${savedId}`, window.location.origin).toString()
    : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={empty || pending || Boolean(savedId)}
          data-testid="save-build"
          className="col-span-2"
        >
          {savedId ? <CheckIcon className="text-success" /> : <Share2Icon />}
          {pending ? t('saving') : savedId ? t('saved') : t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPdf}
          disabled={empty || pending}
          data-testid="build-pdf"
          className="col-span-2"
        >
          <FileDownIcon />
          {t('pdf')}
        </Button>
      </div>
      {shareUrl && savedId && (
        <div
          className="space-y-2 rounded-lg border border-success/25 bg-success/5 p-3"
          data-testid="share-box"
        >
          <div className="flex gap-2">
            <Input
              readOnly
              value={shareUrl}
              aria-label={t('copyLink')}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
              data-testid="share-url"
            />
            <CopyLinkButton url={shareUrl} publicId={savedId} />
          </div>
          <Link href={`/b/${savedId}`} className="text-xs text-brand-bright hover:underline">
            {t('openShared')}
          </Link>
        </div>
      )}
    </div>
  );
}
