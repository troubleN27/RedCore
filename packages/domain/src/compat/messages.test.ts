import { locales } from '@redcore/i18n';
import { messages } from '@redcore/i18n/messages';
import { describe, expect, it } from 'vitest';
import { compatCodes } from './types';

function lookup(tree: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);
}

describe('тексты совместимости', () => {
  it.each(locales)('у каждого кода есть сообщение на %s', (locale) => {
    const missing = compatCodes.filter(
      (code) => typeof lookup(messages[locale].compat, code) !== 'string',
    );
    expect(missing).toEqual([]);
  });
});
