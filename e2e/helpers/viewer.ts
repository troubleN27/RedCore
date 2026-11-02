import { expect, type Page } from '@playwright/test';

export async function stats(page: Page) {
  return page.evaluate(() => window.__redcoreViewerStats ?? null);
}

/** 3D-предпросмотр товара (остался в админке): ждём, пока сцена отрисует модель */
export async function waitForViewer(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const viewer = page.getByTestId('product-viewer');
  await viewer.scrollIntoViewIfNeeded();
  // На телефоне 3D открывается кнопкой (не грузим three.js без запроса)
  const open = viewer.getByTestId('viewer-open');
  if ((page.viewportSize()?.width ?? 1280) < 768) await open.click();
  await expect(viewer.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => stats(page), { timeout: 30_000 }).not.toBeNull();
  return { viewer, errors };
}
