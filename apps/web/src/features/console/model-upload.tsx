'use client';

import { formatNumber } from '@redcore/i18n';
import { UploadIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { detachModelAction } from '@/server/console-actions';

type UploadError = 'not_glb' | 'too_large' | 'too_many_triangles' | 'empty' | 'invalid' | 'failed';
const MAX_BYTES = 15_000_000;

/**
 * Загрузка своей GLB. С R2: presign → PUT прямо в бакет → commit (сервер проверяет файл).
 * Без R2: multipart в /api/console/models, файл хранится в базе.
 */
async function upload(
  productId: string,
  file: File,
  r2: boolean,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };
  if (r2) {
    const presign = await fetch('/api/console/models/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, size: file.size }),
    });
    if (!presign.ok) return { ok: false, error: 'failed' };
    const { uploadUrl, publicUrl } = (await presign.json()) as {
      uploadUrl: string;
      publicUrl: string;
    };
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'model/gltf-binary' },
      body: file,
    });
    if (!put.ok) return { ok: false, error: 'failed' };
    const commit = await fetch('/api/console/models/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, filename: file.name, publicUrl }),
    });
    const body = (await commit.json().catch(() => ({}))) as { error?: UploadError };
    return commit.ok ? { ok: true } : { ok: false, error: body.error ?? 'failed' };
  }
  const form = new FormData();
  form.set('productId', productId);
  form.set('file', file);
  const response = await fetch('/api/console/models', { method: 'POST', body: form });
  const body = (await response.json().catch(() => ({}))) as { error?: UploadError };
  return response.ok ? { ok: true } : { ok: false, error: body.error ?? 'failed' };
}

export function ModelUpload({
  productId,
  current,
  r2,
}: {
  productId: string;
  current: { sizeBytes?: number; triangles?: number } | null;
  r2: boolean;
}) {
  const t = useTranslations('console.products.form');
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<UploadError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3" data-testid="model-upload">
      <p className="text-xs text-steel-400">{t('modelHint')}</p>
      <p className="text-sm" data-testid="model-current">
        {current
          ? t('modelCurrent', {
              size: formatNumber(Math.round((current.sizeBytes ?? 0) / 1000), locale),
              triangles: formatNumber(current.triangles ?? 0, locale),
            })
          : t('modelNone')}
      </p>
      <input
        ref={input}
        type="file"
        accept=".glb,model/gltf-binary"
        className="sr-only"
        data-testid="model-file"
        aria-label={t('modelUpload')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError(null);
          startTransition(async () => {
            const result = await upload(productId, file, r2);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success(t('modelUploaded'));
            router.refresh();
          });
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <UploadIcon />
          {pending ? t('modelUploading') : t('modelUpload')}
        </Button>
        {current && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await detachModelAction(productId);
                if (result.ok) {
                  toast.success(t('modelRemoved'));
                  router.refresh();
                }
              })
            }
          >
            <XIcon />
            {t('modelRemove')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger" data-testid="model-error">
          {t(`modelErrors.${error}`)}
        </p>
      )}
    </div>
  );
}
