'use client';

import type { SpecField } from '@redcore/domain';
import { useMessages, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adjustStockAction, saveProductAction } from '@/server/console-actions';
import { useConsoleHref } from './console-base';

export interface ProductFormValues {
  sku: string;
  slug: string;
  name: string;
  brandId: string;
  categoryId: string;
  priceUzs: number;
  compareAtPriceUzs: number | null;
  costUzs: number | null;
  status: 'draft' | 'active' | 'archived';
  isFeatured: boolean;
  warrantyMonths: number;
  specs: Record<string, unknown>;
  shortRu: string;
  shortUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
}

const STATUSES = ['active', 'draft', 'archived'] as const;
const TEXT_FIELDS = ['sku', 'slug', 'name'] as const;
const NUMBER_FIELDS = [
  ['priceUzs', 'price'],
  ['compareAtPriceUzs', 'compareAt'],
  ['costUzs', 'cost'],
  ['warrantyMonths', 'warranty'],
] as const;
const TRANSLATION_FIELDS = ['shortRu', 'shortUz', 'descriptionRu', 'descriptionUz'] as const;
const inputClass = 'h-9 w-full rounded-md border border-input bg-graphite-900 px-2 text-sm';

/** Значение поля характеристики → строка для input и обратно. */
function toText(field: SpecField, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (field.kind === 'multi' && Array.isArray(value)) return value.join(', ');
  if (field.kind === 'json') return JSON.stringify(value);
  return String(value);
}

function fromText(field: SpecField, text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  switch (field.kind) {
    case 'number':
      return Number(trimmed.replace(',', '.'));
    case 'enum':
      return typeof field.options[0] === 'number' ? Number(trimmed) : trimmed;
    case 'multi': {
      const items = trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return field.options && typeof field.options[0] === 'number' ? items.map(Number) : items;
    }
    case 'json':
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    default:
      return trimmed;
  }
}

export function ProductForm({
  id,
  initial,
  categories,
  brands,
  fieldsByCategory,
  stock,
}: {
  id?: string;
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  fieldsByCategory: Record<string, SpecField[]>;
  stock?: { stockQty: number; reservedQty: number };
}) {
  const t = useTranslations('console.products.form');
  const tp = useTranslations('console.products');
  const tc = useTranslations('console.common');
  const specLabels = (
    useMessages() as {
      specs: { labels: Record<string, string>; boolean: { true: string; false: string } };
    }
  ).specs;
  const router = useRouter();
  const href = useConsoleHref();
  const [values, setValues] = useState(initial);
  const [specText, setSpecText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (fieldsByCategory[initial.categoryId] ?? []).map((f) => [
        f.key,
        toText(f, initial.specs[f.key]),
      ]),
    ),
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const fields = fieldsByCategory[values.categoryId] ?? [];

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const num = (text: string) => (text.trim() === '' ? null : Number(text.replace(/\s/g, '')));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const specs: Record<string, unknown> = {};
    for (const field of fields) {
      const value =
        field.kind === 'boolean'
          ? specText[field.key] === 'true'
          : fromText(field, specText[field.key] ?? '');
      if (value !== undefined) specs[field.key] = value;
    }
    startTransition(async () => {
      const result = await saveProductAction({ ...values, specs }, id);
      if (!result.ok) {
        setInvalid(result.fields ?? []);
        toast.error(
          result.fields?.length ? t('invalid', { fields: result.fields.join(', ') }) : tc('error'),
        );
        return;
      }
      setInvalid([]);
      toast.success(id ? t('saved') : t('created'));
      if (!id && result.id) router.replace(href(`/products/${result.id}`));
      else router.refresh();
    });
  }

  const bad = (key: string) => invalid.some((f) => f === key || f.startsWith(`${key}.`));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={submit} className="min-w-0 space-y-4" data-testid="product-form" noValidate>
        <section className="grid gap-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-steel-300 sm:col-span-2">{t('basics')}</h2>
          {TEXT_FIELDS.map((key) => (
            <div key={key} className={key === 'name' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
              <Label htmlFor={`pf-${key}`}>{t(key)}</Label>
              <Input
                id={`pf-${key}`}
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                aria-invalid={bad(key)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="pf-brand">{t('brand')}</Label>
            <select
              id="pf-brand"
              value={values.brandId}
              onChange={(e) => set('brandId', e.target.value)}
              className={inputClass}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-category">{t('category')}</Label>
            <select
              id="pf-category"
              value={values.categoryId}
              disabled={Boolean(id)}
              onChange={(e) => set('categoryId', e.target.value)}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {NUMBER_FIELDS.map(([key, labelKey]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`pf-${key}`}>{t(labelKey)}</Label>
              <Input
                id={`pf-${key}`}
                inputMode="numeric"
                value={values[key] ?? ''}
                aria-invalid={bad(key)}
                onChange={(e) => {
                  const n = num(e.target.value);
                  set(
                    key,
                    (key === 'priceUzs' || key === 'warrantyMonths' ? (n ?? 0) : n) as never,
                  );
                }}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="pf-status">{t('status')}</Label>
            <select
              id="pf-status"
              value={values.status}
              onChange={(e) => set('status', e.target.value as ProductFormValues['status'])}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tp(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <Label className="flex items-center gap-2 self-end pb-2 font-normal">
            <Checkbox
              checked={values.isFeatured}
              onCheckedChange={(v) => set('isFeatured', v === true)}
            />
            {t('featured')}
          </Label>
        </section>

        <section
          className="grid gap-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 sm:grid-cols-2"
          data-testid="spec-fields"
        >
          <div className="sm:col-span-2">
            <h2 className="text-sm font-semibold text-steel-300">{t('specs')}</h2>
            <p className="text-xs text-steel-400">{t('specsHint')}</p>
          </div>
          {fields.map((field) => {
            const label = specLabels.labels[field.key] ?? field.key;
            const id = `spec-${field.key}`;
            const value = specText[field.key] ?? '';
            const update = (v: string) => setSpecText((s) => ({ ...s, [field.key]: v }));
            return (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={id}>{label}</Label>
                {field.kind === 'enum' ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => update(e.target.value)}
                    className={inputClass}
                    aria-invalid={bad(`specs.${field.key}`)}
                  >
                    {field.optional && <option value="">{'—'}</option>}
                    {field.options.map((o) => (
                      <option key={String(o)} value={String(o)}>
                        {String(o)}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'boolean' ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => update(e.target.value)}
                    className={inputClass}
                  >
                    <option value="true">{specLabels.boolean.true}</option>
                    <option value="false">{specLabels.boolean.false}</option>
                  </select>
                ) : (
                  <Input
                    id={id}
                    inputMode={field.kind === 'number' ? 'decimal' : undefined}
                    value={value}
                    onChange={(e) => update(e.target.value)}
                    aria-invalid={bad(`specs.${field.key}`)}
                    placeholder={
                      field.kind === 'multi' && field.options ? field.options.join(', ') : undefined
                    }
                    title={field.kind === 'multi' ? t('listHint') : undefined}
                  />
                )}
              </div>
            );
          })}
        </section>

        <section className="grid gap-3 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-steel-300 sm:col-span-2">
            {t('translations')}
          </h2>
          {TRANSLATION_FIELDS.map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`pf-${key}`}>{t(key)}</Label>
              <textarea
                id={`pf-${key}`}
                value={values[key] ?? ''}
                rows={key.startsWith('short') ? 2 : 5}
                onChange={(e) => set(key, e.target.value as never)}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </section>

        <Button type="submit" disabled={pending} data-testid="product-save">
          {tc('save')}
        </Button>
      </form>

      {id && stock && (
        <aside className="space-y-3 self-start rounded-xl border border-graphite-800 bg-graphite-900/60 p-4">
          <h2 className="text-sm font-semibold text-steel-300">{t('stock')}</h2>
          <p className="text-sm" data-testid="stock-numbers">
            {`${stock.stockQty} / ${stock.reservedQty}`}
          </p>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await adjustStockAction(id, Number(delta), note);
                if (result.ok) {
                  toast.success(tc('saved'));
                  setDelta('');
                  setNote('');
                  router.refresh();
                } else toast.error(tc('error'));
              });
            }}
          >
            <Label htmlFor="stock-delta">{t('stockDelta')}</Label>
            <Input
              id="stock-delta"
              inputMode="numeric"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
            <Label htmlFor="stock-note">{t('stockNote')}</Label>
            <Input id="stock-note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={pending || !delta}
              data-testid="stock-apply"
            >
              {t('stockApply')}
            </Button>
          </form>
        </aside>
      )}
    </div>
  );
}
