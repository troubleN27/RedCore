import type { Database } from '@redcore/db';
import {
  checkBuild,
  checkCandidate,
  gpuIndexFor,
  type AnyCatalogProduct,
  type PerfIndex,
} from '@redcore/domain';
import type { Locale } from '@redcore/i18n';
import {
  BuildValidationError,
  createProductCopyDraft,
  getCatalogSnapshot,
  getPerfIndex,
  productCopySchema,
  resolveBuild,
  saveBuild,
} from '@redcore/services';
import { z } from 'zod';
import type { ToolDeclaration } from '../gateway/types';
import type { AgentName, UiPayload } from './events';

// UI-инструменты (план, §8): модель «предлагает», сервер проверяет и превращает предложение
// в карточку по данным из БД. Ни одна карточка не строится по тексту модели.

export interface UiToolContext {
  db: Database;
  locale: Locale;
  userId: string | null;
  siteUrl: string;
  allowedHandoff: AgentName[];
}

export type UiToolResult =
  | { ok: true; result: unknown; ui?: UiPayload; handoff?: { to: AgentName; reason: string } }
  | { ok: false; result: { error: string; message: string } };

const itemsSchema = z
  .array(z.object({ slug: z.string(), qty: z.number().int().min(1).max(8).default(1) }))
  .min(1)
  .max(30);

const schemas = {
  propose_build: z.object({ title: z.string().max(80), items: itemsSchema }),
  propose_swap: z.object({
    items: itemsSchema,
    slot: z.string(),
    toSlug: z.string(),
    reason: z.string().max(300),
  }),
  show_products: z.object({ slugs: z.array(z.string()).min(1).max(8) }),
  handoff: z.object({
    agent: z.enum(['consultant', 'reviewer', 'support', 'admin']),
    reason: z.string().max(200),
  }),
  propose_product_copy: z.object({
    slug: z.string(),
    ru: productCopySchema.shape.ru,
    uz: productCopySchema.shape.uz,
  }),
};
export type UiToolName = keyof typeof schemas;

const descriptions: Record<UiToolName, string> = {
  propose_build:
    'Show the customer a complete build as a card with an "Open in configurator" button. Use slugs from tool ' +
    'results only. The server re-checks compatibility and rejects builds with errors.',
  propose_swap:
    'Suggest replacing one part of the current build with another product (button "Replace"). Pass the current ' +
    'build items, the slot and the new product slug.',
  show_products: 'Show product cards (from the database) for the given slugs.',
  handoff: 'Pass the conversation to another assistant when the request is out of your scope.',
  propose_product_copy:
    'Staff only: propose RU and UZ product descriptions as a draft. Nothing is published until a manager applies it.',
};

export function uiToolDeclarations(names: UiToolName[]): ToolDeclaration[] {
  return names.map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name], { target: 'draft-2020-12' }) as Record<
      string,
      unknown
    >,
  }));
}

export function isUiTool(name: string): name is UiToolName {
  return name in schemas;
}

function perfScore(p: AnyCatalogProduct | undefined, perf: PerfIndex): number | null {
  if (!p) return null;
  if (p.componentType === 'gpu') {
    const g = perf.gpu[p.specs.chip];
    return g ? gpuIndexFor(g, '1440p') : null;
  }
  if (p.componentType === 'cpu')
    return p.perfKey ? (perf.cpu[p.perfKey]?.gamingIndex ?? null) : null;
  return null;
}

const fail = (error: string, message: string): UiToolResult => ({
  ok: false,
  result: { error, message },
});

export async function runUiTool(
  name: UiToolName,
  rawArgs: unknown,
  ctx: UiToolContext,
): Promise<UiToolResult> {
  const parsed = schemas[name].safeParse(rawArgs);
  if (!parsed.success)
    return fail('invalid_args', parsed.error.issues.map((i) => i.path.join('.')).join(', '));
  const snapshot = await getCatalogSnapshot(ctx.db, ctx.locale);

  try {
    switch (name) {
      case 'propose_build': {
        const args = parsed.data as z.infer<typeof schemas.propose_build>;
        const perf = await getPerfIndex(ctx.db);
        const { build } = resolveBuild(snapshot, args.items);
        const check = checkBuild(build, perf);
        const errors = check.issues.filter((i) => i.severity === 'error').map((i) => i.code);
        if (errors.length > 0)
          return fail('incompatible', `Build has errors: ${errors.join(', ')}`);
        const saved = await saveBuild(
          ctx.db,
          snapshot,
          perf,
          { items: args.items, name: args.title, source: 'ai' },
          ctx.userId,
        );
        const ui: UiPayload = {
          kind: 'build',
          publicId: saved.publicId,
          title: args.title,
          totalUzs: saved.check.totalUzs,
          status: saved.check.status,
          lines: saved.lines.map((l) => ({
            slot: l.slot,
            name: `${l.product.brand} ${l.product.name}`,
            qty: l.qty,
            priceUzs: l.product.priceUzs,
          })),
          items: saved.lines.map((l) => ({ slug: l.product.slug, qty: l.qty })),
        };
        return {
          ok: true,
          ui,
          result: {
            shown: true,
            publicId: saved.publicId,
            totalUzs: saved.check.totalUzs,
            url: `${ctx.siteUrl}/${ctx.locale}/configurator?build=${saved.publicId}`,
          },
        };
      }
      case 'propose_swap': {
        const args = parsed.data as z.infer<typeof schemas.propose_swap>;
        const perf = await getPerfIndex(ctx.db);
        const { build } = resolveBuild(snapshot, args.items);
        const to = snapshot.bySlug.get(args.toSlug);
        if (!to || to.componentType !== args.slot)
          return fail('not_found', 'Unknown product for this slot');
        if (to.available <= 0) return fail('out_of_stock', 'Product is out of stock');
        if (!checkCandidate(build, to, perf).compatible)
          return fail('incompatible', 'Not compatible with the build');
        const current = (build as unknown as Record<string, AnyCatalogProduct | undefined>)[
          args.slot
        ];
        const from = current && !Array.isArray(current) ? current : undefined;
        const before = perfScore(from, perf);
        const after = perfScore(to, perf);
        const ui: UiPayload = {
          kind: 'swap',
          slot: args.slot,
          from: from
            ? { slug: from.slug, name: `${from.brand} ${from.name}`, priceUzs: from.priceUzs }
            : null,
          to: { slug: to.slug, name: `${to.brand} ${to.name}`, priceUzs: to.priceUzs },
          priceDeltaUzs: to.priceUzs - (from?.priceUzs ?? 0),
          perfDeltaPercent: before && after ? Math.round(((after - before) / before) * 100) : null,
          reason: args.reason,
        };
        return { ok: true, ui, result: { shown: true, priceDeltaUzs: ui.priceDeltaUzs } };
      }
      case 'show_products': {
        const args = parsed.data as z.infer<typeof schemas.show_products>;
        const items = args.slugs
          .map((slug) => snapshot.bySlug.get(slug))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => ({
            slug: p.slug,
            name: `${p.brand} ${p.name}`,
            priceUzs: p.priceUzs,
            available: p.available,
            url: `${ctx.siteUrl}/${ctx.locale}/p/${p.slug}`,
          }));
        if (items.length === 0) return fail('not_found', 'No such products');
        return { ok: true, ui: { kind: 'products', items }, result: { shown: items.length } };
      }
      case 'handoff': {
        const args = parsed.data as z.infer<typeof schemas.handoff>;
        if (!ctx.allowedHandoff.includes(args.agent))
          return fail('not_allowed', 'This assistant is not available here');
        return {
          ok: true,
          result: { handedOff: args.agent },
          handoff: { to: args.agent, reason: args.reason },
        };
      }
      case 'propose_product_copy': {
        const args = parsed.data as z.infer<typeof schemas.propose_product_copy>;
        const product = snapshot.bySlug.get(args.slug);
        if (!product) return fail('not_found', 'Unknown product');
        const draft = await createProductCopyDraft(
          ctx.db,
          product.id,
          { ru: args.ru, uz: args.uz },
          ctx.userId,
        );
        return {
          ok: true,
          ui: {
            kind: 'copy',
            draftId: draft.id,
            productName: `${product.brand} ${product.name}`,
            ru: args.ru,
            uz: args.uz,
          },
          result: { draftId: draft.id, status: 'pending_review' },
        };
      }
    }
  } catch (error) {
    if (error instanceof BuildValidationError)
      return fail(error.reason, error.details ?? error.reason);
    throw error;
  }
}
