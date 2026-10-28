type MessageTree = { [key: string]: string | MessageTree };

export interface ParityProblem {
  key: string;
  issue: 'missing' | 'extra' | 'empty' | 'placeholders';
  details?: string;
}

function flatten(tree: MessageTree, prefix = '', out = new Map<string, string>()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else flatten(value, path, out);
  }
  return out;
}

/** Имена ICU-аргументов: «{count, plural, …}» и «{year}» → count, year. */
export function placeholderNames(message: string): string[] {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names].sort();
}

/** Сравнивает словарь-перевод с эталоном: ключи, пустые строки и ICU-аргументы. */
export function compareMessageTrees(reference: object, translation: object): ParityProblem[] {
  const ref = flatten(reference as MessageTree);
  const tr = flatten(translation as MessageTree);
  const problems: ParityProblem[] = [];

  for (const [key, refValue] of ref) {
    const trValue = tr.get(key);
    if (trValue === undefined) {
      problems.push({ key, issue: 'missing' });
      continue;
    }
    if (trValue.trim() === '') problems.push({ key, issue: 'empty' });
    const refArgs = placeholderNames(refValue).join(',');
    const trArgs = placeholderNames(trValue).join(',');
    if (refArgs !== trArgs) {
      problems.push({ key, issue: 'placeholders', details: `[${refArgs}] ≠ [${trArgs}]` });
    }
  }
  for (const key of tr.keys()) {
    if (!ref.has(key)) problems.push({ key, issue: 'extra' });
  }
  for (const [key, value] of ref) {
    if (value.trim() === '') problems.push({ key, issue: 'empty', details: 'reference' });
  }
  return problems;
}
