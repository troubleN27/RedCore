import { expect, test, type Page } from '@playwright/test';

const SLOTS = ['case', 'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case_fan'];

function assembly(page: Page) {
  return page.evaluate(() => window.__redcoreAssembly ?? null);
}

/** Совместимая сборка: в каждом шаге — первая деталь из списка «только совместимые». */
async function fillBuild(page: Page) {
  await page.goto('/ru/configurator');
  await page.evaluate(() => localStorage.removeItem('redcore-configurator'));
  await page.reload();
  await expect(page.getByTestId('configurator')).toHaveAttribute('data-hydrated', 'true');
  const lines = page.getByTestId('summary-lines').locator('li');
  for (const [i, slot] of SLOTS.entries()) {
    await page.getByTestId(`step-${slot}`).click();
    await page.getByTestId('candidate-select').first().click();
    await expect(lines).toHaveCount(i + 1);
  }
}

async function openScene(page: Page) {
  const scene = page.getByTestId('build-scene');
  await scene.scrollIntoViewIfNeeded();
  // На телефоне сцена включается кнопкой
  const open = scene.getByTestId('scene-open');
  if ((page.viewportSize()?.width ?? 1280) < 768) await open.click();
  await expect(scene.locator('canvas')).toBeVisible({ timeout: 60_000 });
  // Корпус, плата, процессор, кулер, память, видеокарта, накопитель, БП и вентиляторы — в сцене
  await expect
    .poll(async () => (await assembly(page))?.parts.length ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(8);
  return scene;
}

/**
 * Замена видеокарты: возвращает время от события клика до изменения состава сцены, мс.
 * Клик засекаем в самой странице — ожидания Playwright перед кликом в замер не входят.
 */
async function swapGpu(page: Page) {
  const before = (await assembly(page))!;
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () => ((window as { __clickAt?: number }).__clickAt = performance.now()),
      { capture: true, once: true },
    );
  });
  await page.getByTestId('candidate-select').and(page.locator(':enabled')).first().click();
  await expect
    .poll(async () => (await assembly(page))!.updatedAt, { timeout: 5_000, intervals: [10] })
    .toBeGreaterThan(before.updatedAt);
  const after = (await assembly(page))!;
  expect(after.parts.find((p) => p.startsWith('gpu:'))).not.toBe(
    before.parts.find((p) => p.startsWith('gpu:')),
  );
  const clickAt = await page.evaluate(() => (window as { __clickAt?: number }).__clickAt ?? 0);
  return after.updatedAt - clickAt;
}

test.describe('3D-сборка в конфигураторе', () => {
  // Программный WebGL в headless-Chromium небыстрый, а сборка проходит все 9 шагов
  test.describe.configure({ timeout: 180_000, mode: 'serial' });

  test('сцена повторяет store: замена быстрее 300 мс, режимы вида, снимок PNG', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await fillBuild(page);
    const scene = await openScene(page);

    await page.getByTestId('step-gpu').click();
    await scene.scrollIntoViewIfNeeded();
    const elapsed = await swapGpu(page);
    expect(elapsed).toBeLessThan(300);

    for (const mode of ['panel', 'exploded', 'focus', 'normal']) {
      await scene.getByTestId(`scene-mode-${mode}`).click();
      await expect(scene).toHaveAttribute('data-mode', mode);
    }
    await scene.getByTestId('scene-quality').selectOption('low');
    await expect(scene).toHaveAttribute('data-quality', 'low');

    const download = page.waitForEvent('download');
    await scene.getByTestId('scene-snapshot').click();
    expect((await download).suggestedFilename()).toBe('redcore-build.png');
    expect(errors).toEqual([]);
  });

  test('50 замен деталей не копят геометрии и текстуры в GPU', async ({ page }) => {
    await fillBuild(page);
    const scene = await openScene(page);
    await scene.getByTestId('scene-quality').selectOption('low');
    await page.getByTestId('step-gpu').click();
    await scene.scrollIntoViewIfNeeded();

    // Прогрев: материалы и шейдеры обеих карт созданы
    for (let i = 0; i < 4; i++) await swapGpu(page);
    await page.waitForTimeout(1500);
    const warm = (await assembly(page))!;

    for (let i = 0; i < 46; i++) await swapGpu(page);
    // Уезжающие детали размонтируются после анимации
    await page.waitForTimeout(2000);
    await expect
      .poll(async () => (await assembly(page))!.geometries, { timeout: 10_000 })
      .toBeLessThanOrEqual(warm.geometries);
    expect((await assembly(page))!.textures).toBeLessThanOrEqual(warm.textures);
  });
});
