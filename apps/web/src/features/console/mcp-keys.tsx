'use client';

import { apiScopes } from '@redcore/services/scopes';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createApiKeyAction, revokeApiKeyAction } from '@/server/console-actions';

const DEFAULT_SCOPES = ['catalog:read', 'builds:read'];

/** Создание ключа: значение показывается один раз — в базе остаётся только хэш. */
export function ApiKeyCreateForm() {
  const t = useTranslations('console.mcp');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [created, setCreated] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        data-testid="api-key-form"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await createApiKeyAction({ name, scopes, userLogin });
            if (result.ok) {
              setCreated(result.key);
              setName('');
              router.refresh();
            } else toast.error(tc('error'));
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="key-name">{t('keys.name')}</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="api-key-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="key-user">{t('keys.userLogin')}</Label>
            <Input id="key-user" value={userLogin} onChange={(e) => setUserLogin(e.target.value)} />
          </div>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">{t('keys.scopes')}</legend>
          {apiScopes.map((scope) => (
            <label key={scope} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={scopes.includes(scope)}
                data-testid={`scope-${scope}`}
                onCheckedChange={(checked) =>
                  setScopes((list) =>
                    checked === true ? [...list, scope] : list.filter((s) => s !== scope),
                  )
                }
              />
              <span>
                <span className="block font-mono text-xs text-steel-400">{scope}</span>
                {t(`scopes.${scope}`)}
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          type="submit"
          disabled={pending || name.trim().length < 2 || scopes.length === 0}
          data-testid="api-key-create"
        >
          {t('keys.create')}
        </Button>
      </form>
      {created && (
        <div
          className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
          role="status"
        >
          <p>{t('keys.created')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="rounded bg-black/40 px-2 py-1 font-mono text-xs break-all"
              data-testid="api-key-value"
            >
              {created}
            </code>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(created);
                toast.success(t('keys.copied'));
              }}
            >
              {t('keys.copy')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApiKeyRevoke({ id }: { id: string }) {
  const t = useTranslations('console.mcp.keys');
  const tc = useTranslations('console.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={pending}
      data-testid="api-key-revoke"
      onClick={() =>
        startTransition(async () => {
          const result = await revokeApiKeyAction(id);
          if (result.ok) router.refresh();
          else toast.error(tc('error'));
        })
      }
    >
      {t('revoke')}
    </Button>
  );
}
