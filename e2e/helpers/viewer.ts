import { expect, type Page } from '@playwright/test';

export async function stats(page: Page) {
  return page.evaluate(() => window.__redcoreViewerStats ?? null);
}

export async function openViewer(page: Page, slug: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/ru/p/${slug}`);
  const viewer = page.getByTestId('product-viewer');
  await viewer.scrollIntoViewIfNeeded();
  // На телефоне 3D открывается кнопкой (не грузим three.js без запроса)
  const open = viewer.getByTestId('viewer-open');
  if ((page.viewportSize()?.width ?? 1280) < 768) await open.click();
  await expect(viewer.locator('canvas')).toBeVisible({ timeout: 30_000 });
  // Сцена отрисовала модель: статистика рендера пошла
  await expect.poll(() => stats(page), { timeout: 30_000 }).not.toBeNull();
  return { viewer, errors };
}
