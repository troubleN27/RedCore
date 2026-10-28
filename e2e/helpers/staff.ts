import { expect, type Page } from '@playwright/test';

// Скрытая админ-панель. Секретный путь в dev/CI — /ops-console-dev (ADMIN_BASE_PATH не задан).
export const BASE = '/ops-console-dev';
export const PASSWORD = 'RedCore-Staff-2026';

export async function submitPassword(page: Page, login: string, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.locator('#staff-username').fill(login);
  await page.locator('#staff-password').fill(password);
  await page.getByTestId('staff-submit').click();
}

/** Вход сотрудника: логин (admin, manager) и пароль. */
export async function staffLogin(page: Page, login: string) {
  await submitPassword(page, login);
  await expect(page.getByTestId('console-nav')).toBeVisible();
}
