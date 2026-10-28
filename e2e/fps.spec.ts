import { expect, test, type Page } from '@playwright/test';

async function fpsOf(page: Page, game: string) {
  return Number(
    await page.locator(`[data-testid="fps-row"][data-game="${game}"]`).getAttribute('data-fps'),
  );
}

test.describe('калькулятор FPS', () => {
  test('20 игр, пометка «Оценка», настройки меняют расчёт', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/ru/fps');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Калькулятор FPS');
    await expect(page.getByTestId('fps-estimate-badge')).toHaveText('Оценка');
    // 20 игр из seed; консольный тест может добавить свою — поэтому «не меньше»
    await expect.poll(() => page.getByTestId('fps-row').count()).toBeGreaterThanOrEqual(20);

    const at1440 = await fpsOf(page, 'cyberpunk-2077');
    await page.getByTestId('fps-res-2160p').click();
    await expect.poll(() => fpsOf(page, 'cyberpunk-2077')).toBeLessThan(at1440);
    const native4k = await fpsOf(page, 'cyberpunk-2077');
    await page.getByTestId('fps-upscale').selectOption('performance');
    await expect.poll(() => fpsOf(page, 'cyberpunk-2077')).toBeGreaterThan(native4k);
    await page.getByTestId('fps-framegen').selectOption('4x');
    await expect(page.locator('[data-testid="fps-row"][data-game="cyberpunk-2077"]')).toContainText(
      'С генерацией кадров 4×',
    );
    // Elden Ring ограничен движком 60 кадрами
    await page.getByTestId('fps-res-1080p').click();
    await page.getByTestId('fps-preset-low').click();
    await expect(page.locator('[data-testid="fps-row"][data-game="elden-ring"]')).toHaveAttribute(
      'data-limiter',
      'cap',
    );
    expect(errors).toEqual([]);
  });

  test('«Хочу N FPS»: варианты из наличия открываются в конфигураторе с панелью FPS', async ({
    page,
  }) => {
    await page.goto('/ru/fps');
    await page.getByTestId('fps-tab-reverse').click();
    await page.getByTestId('reverse-game').selectOption('cyberpunk-2077');
    await page.getByTestId('reverse-target').fill('60');
    await page.getByTestId('reverse-preset-ultra').click();
    await page.getByTestId('reverse-submit').click();
    const variants = page.getByTestId('reverse-variant');
    await expect(variants.first()).toBeVisible({ timeout: 20_000 });
    expect(await variants.count()).toBeGreaterThanOrEqual(2);
    for (const fps of await variants.evaluateAll((els) => els.map((e) => Number(e.dataset.fps)))) {
      expect(fps).toBeGreaterThanOrEqual(60);
    }

    await variants.first().getByTestId('reverse-open').click();
    await expect(page).toHaveURL(/\/ru\/configurator$/);
    await expect(page.getByTestId('summary-lines').locator('li')).toHaveCount(8);
    const panel = page.getByTestId('fps-panel');
    await expect.poll(() => panel.getByTestId('fps-row').count()).toBeGreaterThanOrEqual(20);
    const cp = Number(await panel.locator('[data-game="cyberpunk-2077"]').getAttribute('data-fps'));
    expect(cp).toBeGreaterThan(0);
  });

  test('недостижимая цель — честный ответ и подсказка', async ({ page }) => {
    await page.goto('/ru/fps');
    await page.getByTestId('fps-tab-reverse').click();
    await page.getByTestId('reverse-game').selectOption('msfs-2024');
    await page.getByTestId('reverse-target').fill('900');
    await page.getByTestId('reverse-submit').click();
    await expect(page.getByTestId('reverse-unachievable')).toContainText(
      'Цель недостижима на товарах в наличии.',
    );
  });

  test('узбекская версия', async ({ page }) => {
    await page.goto('/uz/fps');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FPS kalkulyatori');
    await expect(page.getByTestId('fps-estimate-badge')).toHaveText('Taxmin');
    // 20 игр из seed; консольный тест может добавить свою — поэтому «не меньше»
    await expect.poll(() => page.getByTestId('fps-row').count()).toBeGreaterThanOrEqual(20);
  });
});
