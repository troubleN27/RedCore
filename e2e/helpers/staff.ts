import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

// Скрытая админ-панель. Секретный путь в dev/CI — /ops-console-dev (ADMIN_BASE_PATH не задан).
export const BASE = '/ops-console-dev';
export const PASSWORD = 'RedCore-Staff-2026';

// dev-сервер живёт между прогонами вместе с базой: секрет 2FA, подключённый в прошлый раз,
// храним рядом, чтобы повторный запуск входил по коду, а не подключал 2FA заново
const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'redcore-e2e');
const secretFile = (email: string) => path.join(cacheDir, `totp-${email}.txt`);

function base32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase())
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238: 6 цифр, шаг 30 с, HMAC-SHA1 — как в Google Authenticator. */
export function totp(secret: string, offset = 0): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const h = createHmac('sha1', base32(secret)).update(counter).digest();
  const o = h[19]! & 15;
  const code = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
}

export async function submitPassword(page: Page, email: string, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.locator('#staff-email').fill(email);
  await page.locator('#staff-password').fill(password);
  await page.getByTestId('staff-submit').click();
}

/** Вход сотрудника: пароль → (первый раз) подключение 2FA → код TOTP. */
export async function staffLogin(page: Page, email: string) {
  await submitPassword(page, email);
  const enroll = page.getByTestId('enroll');
  const totpInput = page.locator('#staff-totp');
  await expect(enroll.or(totpInput)).toBeVisible();
  if (await enroll.isVisible()) {
    await page.locator('#enroll-password').fill(PASSWORD);
    await page.getByTestId('enroll-start').click();
    const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(secretFile(email), secret);
    await page.locator('#enroll-code').fill(totp(secret));
    await page.getByTestId('enroll-confirm').click();
  } else {
    const secret = readFileSync(secretFile(email), 'utf8').trim();
    await totpInput.fill(totp(secret));
    await page.getByTestId('totp-submit').click();
  }
  await expect(page.getByTestId('console-nav')).toBeVisible();
}
