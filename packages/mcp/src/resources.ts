import type { McpServer } from '@modelcontextprotocol/server';
import { formatPrice } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import { loadZones } from '@redcore/services';
import { z } from 'zod';
import { hasScope, type McpContext } from './context';
import { snapshotOf } from './tools/catalog';

const POLICIES = ['delivery', 'payment', 'warranty', 'returns'] as const;

/** Ресурсы: категории каталога и правила магазина (доставка, оплата, гарантия, возврат). */
export function registerResources(server: McpServer, ctx: McpContext) {
  if (!hasScope(ctx, 'catalog:read')) return;
  const t = getTranslator(ctx.locale);

  server.registerResource(
    'categories',
    'catalog://categories',
    { title: 'Категории каталога', mimeType: 'application/json' },
    async (uri) => {
      const snapshot = await snapshotOf(ctx);
      const data = snapshot.categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        type: c.componentType,
        products: c.productCount,
      }));
      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data) }],
      };
    },
  );

  for (const key of POLICIES) {
    server.registerResource(
      `policy-${key}`,
      `policy://${key}`,
      { title: t(`policies.${key}.title`), mimeType: 'text/markdown' },
      async (uri) => {
        let text = `# ${t(`policies.${key}.title`)}\n\n${t(`policies.${key}.text`)}`;
        if (key === 'delivery') {
          const zones = await loadZones(ctx.db, ctx.locale);
          text +=
            '\n\n' +
            zones
              .map(
                (z) =>
                  `- ${z.name} (${z.code}): ${formatPrice(z.priceUzs, ctx.locale)}, ` +
                  `${z.etaMinDays}–${z.etaMaxDays} d` +
                  (z.freeFromUzs ? `, free from ${formatPrice(z.freeFromUzs, ctx.locale)}` : '') +
                  (z.codAllowed ? ', COD' : ''),
              )
              .join('\n');
        }
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
      },
    );
  }
}

/** Промпты для Claude Desktop и других клиентов: типовые сценарии магазина. */
export function registerPrompts(server: McpServer, ctx: McpContext) {
  if (!hasScope(ctx, 'builds:read')) return;
  const lang = ctx.locale === 'uz' ? 'Uzbek (Latin)' : 'Russian';

  server.registerPrompt(
    'build_pc_for_budget',
    {
      title: 'Собрать ПК под бюджет',
      description: 'Pick a compatible PC build from in-stock RedCore products for a budget',
      argsSchema: z.object({
        budgetUzs: z.string().describe('Budget in UZS, e.g. 15000000'),
        purpose: z.string().describe('gaming, esports, workstation or office'),
        games: z.string().optional().describe('Games to play, comma separated'),
      }),
    },
    ({ budgetUzs, purpose, games }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Answer in ${lang}. Build a PC at RedCore for about ${budgetUzs} UZS, purpose: ${purpose}.` +
              (games ? ` Games: ${games}.` : '') +
              ' Use generate_builds, then check_compatibility and estimate_fps for the chosen ' +
              'variant. Quote only prices and products returned by the tools; mention that FPS is an estimate.',
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'check_my_build',
    {
      title: 'Проверить мою сборку',
      description: 'Check compatibility and balance of a list of RedCore products',
      argsSchema: z.object({
        products: z.string().describe('Product names or slugs, comma separated'),
      }),
    },
    ({ products }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Answer in ${lang}. Find these RedCore products with search_products: ${products}. ` +
              'Then run check_compatibility on the found slugs and explain every issue and how to fix it.',
          },
        },
      ],
    }),
  );
}
