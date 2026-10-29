import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Доступность (план, этап 12): axe-core на ключевых страницах. Падаем на critical и serious
// (контраст, подписи полей, роли), moderate/minor смотрим в отчёте.

const pages = [
  '/ru',
  '/uz',
  '/ru/catalog',
  '/ru/catalog/gpu',
  '/ru/search?q=ryzen',
  '/ru/configurator',
  '/ru/fps',
  '/ru/cart',
  '/ru/compare',
  '/ru/login',
  '/ru/prebuilt',
  '/ru/help/delivery',
];

test.describe('доступность (axe)', () => {
  test.describe.configure({ timeout: 90_000 });

  for (const path of pages) {
    test(`без critical и serious нарушений: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Canvas 3D-сцены и поток SSE чата axe не анализирует осмысленно
        .exclude('canvas')
        .analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'critical' || v.impact === 'serious')
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        );
      expect(blocking, blocking.join('\n')).toEqual([]);
    });
  }

  test('карточка товара', async ({ page, request }) => {
    const search = await request.get('/api/search?locale=ru&q=RTX');
    const { items } = (await search.json()) as { items: { slug: string }[] };
    await page.goto(`/ru/p/${items[0]!.slug}`);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map(
        (v) =>
          `${v.id}: ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
      );
    expect(blocking, blocking.join('\n')).toEqual([]);
  });
});
