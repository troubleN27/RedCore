// Проверка паритета словарей ru ↔ uz. Запуск: pnpm i18n:check (используется и в CI).
import { locales } from './config';
import { messages } from './messages';
import { compareMessageTrees } from './parity';

let failed = false;

for (const locale of locales) {
  if (locale === 'ru') continue;
  const problems = compareMessageTrees(messages.ru, messages[locale]);
  if (problems.length === 0) {
    console.log(`✔ ${locale}: ключи совпадают с ru`);
    continue;
  }
  failed = true;
  console.error(`✖ ${locale}: найдено проблем — ${problems.length}`);
  for (const problem of problems) {
    console.error(
      `  ${problem.issue.padEnd(12)} ${problem.key}${problem.details ? `  ${problem.details}` : ''}`,
    );
  }
}

process.exit(failed ? 1 : 0);
