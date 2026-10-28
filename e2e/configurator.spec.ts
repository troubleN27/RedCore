import { expect, test, type Page } from '@playwright/test';

/** Выбирает товар в шаге конфигуратора, в том числе несовместимый с уже выбранными. */
async function pick(page: Page, slot: string, name: string) {
  // До гидрации клики по шагам ничего не делают
  await expect(page.getByTestId('configurator')).toHaveAttribute('data-hydrated', 'true', {
    timeout: 30_000,
  });
  await page.getByTestId(`step-${slot}`).click();
  const onlyCompatible = page.getByTestId('only-compatible');
  if ((await onlyCompatible.getAttribute('data-state')) === 'checked') await onlyCompatible.click();
  await page.getByRole('searchbox').fill(name);
  const candidate = page.getByTestId('candidate').filter({ hasText: name }).first();
  await candidate.getByTestId('candidate-select').click();
  // После выбора конфигуратор сам переходит к следующему шагу — проверяем по итоговой панели
  await expect(page.getByTestId('summary-lines')).toContainText(name);
}

// На странице конфигуратора теперь 3D-сборка: в headless-Chromium WebGL программный (SwiftShader),
// и первая компиляция шейдеров под параллельной нагрузкой съедает заметную часть 30 с по умолчанию
test.describe.configure({ timeout: 90_000 });

function issue(page: Page, code: string) {
  return page.getByTestId('build-summary').locator(`[data-code="${code}"] p`);
}

/** Тот же черновик на узбекском: состав хранится в браузере, тексты — из словаря uz. */
async function expectUzbek(page: Page, code: string, text: string) {
  await page.goto('/uz/configurator');
  await expect(issue(page, code)).toContainText(text);
  await expect(page.getByTestId('build-summary').getByTestId('build-status')).toHaveText(
    'Mos kelmaslik bor',
  );
}

test.describe('конфигуратор: несовместимость на RU и UZ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru/configurator');
    await page.evaluate(() => localStorage.removeItem('redcore-configurator'));
    await page.reload();
  });

  test('процессор AM5 и плата LGA1700', async ({ page }) => {
    await pick(page, 'cpu', 'Ryzen 7 9800X3D');
    await page.getByTestId('step-motherboard').click();
    // По умолчанию несовместимые платы скрыты
    await expect(page.getByText(/Скрыто несовместимых: \d+/)).toBeVisible();
    await pick(page, 'motherboard', 'PRO B760M-A WiFi DDR4');
    await expect(issue(page, 'cpu.socketMismatch')).toHaveText(
      /Сокет процессора AM5 не подходит к плате с сокетом LGA1700/,
    );
    await expect(page.getByTestId('step-motherboard')).toHaveAttribute('data-state', 'error');
    await expectUzbek(page, 'cpu.socketMismatch', 'AM5 LGA1700 soketli ona plataga mos kelmaydi');
  });

  test('память DDR4 в плате DDR5', async ({ page }) => {
    await pick(page, 'motherboard', 'MAG B850 Tomahawk Max WiFi');
    await pick(page, 'ram', 'Vengeance LPX 32GB');
    await expect(issue(page, 'ram.typeMismatchBoard')).toContainText(
      'Память DDR4 не встанет в плату с поддержкой DDR5.',
    );
    await expectUzbek(page, 'ram.typeMismatchBoard', 'DDR4 xotira DDR5 xotirani');
  });

  test('RTX 5090 в ITX-корпусе', async ({ page }) => {
    await pick(page, 'case', 'MasterBox NR200P V2');
    await pick(page, 'gpu', 'ROG Astral GeForce RTX 5090');
    await expect(issue(page, 'gpu.tooLong')).toContainText('Видеокарта 357 мм не помещается');
    await expectUzbek(page, 'gpu.tooLong', '357');
  });

  test('высокий кулер в корпусе до 155 мм', async ({ page }) => {
    await pick(page, 'case', 'MasterBox NR200P V2');
    await pick(page, 'cooler', 'AK620 Digital');
    await expect(issue(page, 'cooler.tooTall')).toContainText(
      'Кулер высотой 162 мм не влезет: в корпусе до 155 мм.',
    );
    await expectUzbek(page, 'cooler.tooTall', '162');
  });

  test('блок питания 550 Вт под RTX 5080', async ({ page }) => {
    await pick(page, 'cpu', 'Ryzen 7 9800X3D');
    await pick(page, 'gpu', 'RTX 5080 16G Ventus 3X OC');
    await pick(page, 'psu', 'PK550D 550W');
    const summary = page.getByTestId('build-summary');
    await expect(summary.getByTestId('build-status')).toHaveAttribute('data-status', 'errors');
    await expect(
      issue(page, 'psu.belowRecommended').or(issue(page, 'psu.insufficient')),
    ).toBeVisible();
    await expect(summary.getByTestId('psu-load')).toHaveText(/Загрузка БП \d+%/);
    await expect(page.getByTestId('step-psu')).toHaveAttribute('data-state', 'error');
    await page.goto('/uz/configurator');
    await expect(page.getByTestId('build-summary').getByTestId('psu-load')).toHaveText(
      /Quvvat bloki yuklamasi \d+%/,
    );
  });
});

test.describe('конфигуратор: сохранение и ссылка', () => {
  test('совместимая сборка сохраняется и открывается в другом браузере', async ({
    page,
    browser,
  }) => {
    await page.goto('/ru/configurator');
    await page.evaluate(() => localStorage.removeItem('redcore-configurator'));
    await page.reload();
    await pick(page, 'cpu', 'Ryzen 7 9800X3D');
    await pick(page, 'motherboard', 'MAG B850 Tomahawk Max WiFi');
    await pick(page, 'ram', 'Fury Beast 32GB (2×16GB) DDR5-6000');
    const summary = page.getByTestId('build-summary');
    await expect(
      summary.getByTestId('compat-issues').locator('[data-severity="error"]'),
    ).toHaveCount(0);

    await page.getByTestId('save-build').click();
    const shareUrl = await page.getByTestId('share-url').inputValue();
    expect(shareUrl).toMatch(/\/ru\/b\/[0-9A-Za-z]{10}$/);

    // «Другой браузер» — отдельный контекст без localStorage
    const other = await browser.newContext();
    const guest = await other.newPage();
    await guest.goto(shareUrl.replace('/ru/', '/uz/'));
    await expect(guest.getByTestId('shared-line')).toHaveCount(3);
    await expect(guest.getByRole('heading', { level: 1 })).toHaveText('Kompyuter yigʻmasi');

    const pdf = await guest.request.get(
      (await guest.getByTestId('shared-pdf').getAttribute('href')) ?? '',
    );
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    await guest.getByTestId('open-in-configurator').click();
    await expect(guest).toHaveURL(/\/uz\/configurator$/);
    const lines = guest.getByTestId('summary-lines').locator('li');
    await expect(lines).toHaveCount(3);
    await expect(guest.getByTestId('share-url')).toHaveValue(shareUrl.replace('/ru/', '/uz/'));
    await other.close();
  });

  test('вся сборка добавляется в корзину', async ({ page }) => {
    await page.goto('/ru/configurator');
    await page.evaluate(() => localStorage.removeItem('redcore-configurator'));
    await page.reload();
    await pick(page, 'cpu', 'Ryzen 7 9800X3D');
    await pick(page, 'storage', '990 Pro 1TB');
    await page.getByTestId('build-to-cart').click();
    await expect(page.getByText('В корзину добавлено 2 позиции')).toBeVisible();
    const cart = await page.evaluate(
      () => JSON.parse(localStorage.getItem('redcore-shop') ?? '{}').state?.cart,
    );
    expect(Object.keys(cart)).toHaveLength(2);
  });
});
