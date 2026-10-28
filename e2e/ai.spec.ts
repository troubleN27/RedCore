import { expect, test, type Locator, type Page } from '@playwright/test';

// В dev и CI ключа Gemini нет — проверяем то, что видит покупатель в этом режиме:
// детерминированные ответы на тех же инструментах MCP. Цикл с LLM покрыт юнит-тестами
// пакета @redcore/ai на сценарном шлюзе.

async function ask(panel: Locator, text: string) {
  await panel.getByTestId('chat-input').fill(text);
  await panel.getByTestId('chat-send').click();
  const reply = panel.getByTestId('chat-reply').last();
  await expect(panel).toHaveAttribute('data-pending', 'false', { timeout: 30_000 });
  return reply;
}

async function openWidget(page: Page, path: string) {
  await page.goto(path);
  await page.getByTestId('chat-toggle').click();
  return page.getByTestId('chat-widget').getByTestId('chat-panel');
}

test.describe('AI-ассистент', () => {
  test.describe.configure({ timeout: 90_000 });

  test('виджет: подбор под бюджет без LLM → сборка открывается в конфигураторе', async ({
    page,
  }) => {
    const panel = await openWidget(page, '/ru');
    const reply = await ask(panel, 'Игровой ПК до 15 млн сум');
    await expect(reply).toHaveAttribute('data-agent', 'consultant');
    await expect(reply.getByTestId('chat-fallback')).toBeVisible();
    await expect(reply.getByTestId('chat-build')).toHaveCount(3);
    await expect(reply.getByTestId('chat-text')).toContainText('из товаров в наличии');
    await reply.getByTestId('chat-build-open').nth(1).click();
    await expect(page).toHaveURL(/\/ru\/configurator/);
    await expect(page.getByTestId('summary-lines').locator('li')).toHaveCount(8);

    // Агент проверки получает текущую сборку из конфигуратора
    const assistant = page.getByTestId('configurator-assistant');
    await assistant.getByTestId('ai-review-build').click();
    const panelReview = assistant.getByTestId('chat-panel');
    await expect(panelReview).toHaveAttribute('data-place', 'review');
    await expect(panelReview.getByTestId('chat-reply').last()).toHaveAttribute(
      'data-agent',
      'reviewer',
      {
        timeout: 30_000,
      },
    );
    await expect(panelReview.getByTestId('chat-text').last()).not.toBeEmpty();
  });

  test('поддержка: правила возврата и «чужой» заказ без телефона', async ({ page }) => {
    const panel = await openWidget(page, '/ru');
    const policy = await ask(panel, 'Как вернуть товар?');
    await expect(policy).toHaveAttribute('data-agent', 'support');
    await expect(policy.getByTestId('chat-text')).toContainText('10 дней');
    const order = await ask(panel, 'Где мой заказ RC-2026-999999?');
    await expect(order.getByTestId('chat-text')).toContainText('не найден');
  });

  test('узбекский интерфейс и ответы', async ({ page }) => {
    const panel = await openWidget(page, '/uz');
    await expect(panel).toContainText('Yigʻma boʻyicha maslahatchi');
    const reply = await ask(panel, '20 mln soʻmgacha oʻyin kompyuteri');
    await expect(reply.getByTestId('chat-build').first()).toBeVisible();
    await expect(reply.getByTestId('chat-text')).toContainText('mavjud mahsulotlardan');
  });

  test('слишком длинное сообщение не отправляется', async ({ page }) => {
    const panel = await openWidget(page, '/ru');
    const input = panel.getByTestId('chat-input');
    await input.fill('x'.repeat(2500));
    // textarea обрезает ввод до 2000 символов
    expect((await input.inputValue()).length).toBe(2000);
  });
});
