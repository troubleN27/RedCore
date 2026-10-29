import { expect, test } from '@playwright/test';
import { openViewer, stats } from './helpers/viewer';

test.describe('3D-просмотр товара', () => {
  // Программный WebGL в headless-Chromium и первая компиляция сцены — небыстрые
  test.describe.configure({ timeout: 90_000 });
  test('процедурная модель по характеристикам, панель управления, без ошибок', async ({ page }) => {
    // У мониторов нет скачанной модели — схема строится по характеристикам
    const { viewer, errors } = await openViewer(page, 'msi-g244f-e2-24-ips-180-hz');
    await expect(viewer).toHaveAttribute('data-source', 'procedural');
    await expect(viewer).toHaveAttribute('data-quality', /high|medium|low/);
    await expect(viewer.getByText('Схематичная модель по характеристикам товара')).toBeVisible();

    const rotate = viewer.getByTestId('viewer-rotate');
    const initial = await rotate.getAttribute('aria-pressed');
    await rotate.click();
    await expect(rotate).toHaveAttribute('aria-pressed', initial === 'true' ? 'false' : 'true');
    await viewer.getByTestId('viewer-quality').selectOption('low');
    await expect(viewer).toHaveAttribute('data-quality', 'low');
    await expect(viewer.locator('canvas')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('скачанная модель (GLB) видеокарты: загрузка и отрисовка без ошибок', async ({ page }) => {
    const glb: number[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/models/gpu_3fan')) glb.push(r.status());
    });
    const { viewer, errors } = await openViewer(page, 'msi-geforce-rtx-5090-32g-gaming-trio-oc');
    await expect(viewer).toHaveAttribute('data-source', 'glb');
    await expect(viewer.getByText('Схематичная модель по характеристикам товара')).toHaveCount(0);
    expect(glb).toContain(200);
    expect(errors).toEqual([]);
  });

  test('смена цвета не копит ресурсы GPU', async ({ page }) => {
    const { viewer } = await openViewer(page, 'lian-li-o11-dynamic-evo-black');
    const swatches = viewer.getByRole('radio');
    await swatches.nth(1).click();
    await page.waitForTimeout(1500);
    const before = (await stats(page))!;
    for (let i = 0; i < 10; i++) {
      await swatches.nth(i % 3).click();
      await page.waitForTimeout(120);
    }
    await swatches.nth(1).click();
    await page.waitForTimeout(1500);
    const after = (await stats(page))!;
    // Материалы освобождаются при замене — число геометрий и текстур не растёт
    expect(after.geometries).toBeLessThanOrEqual(before.geometries);
    expect(after.textures).toBeLessThanOrEqual(before.textures + 1);
  });

  test('страница авторов и лицензий', async ({ page }) => {
    await page.goto('/ru/credits');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Авторы и лицензии');
    await expect(page.getByTestId('credits-font')).toContainText('Inter');
    await expect(page.getByTestId('credits-font')).toContainText('SIL Open Font License');
    await page.goto('/uz/credits');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mualliflar va litsenziyalar');
  });
});
