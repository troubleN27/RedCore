// Нормализация текста для поиска: одинаково применяется к индексу товара и к запросу.
// Учитывает узбекскую латиницу (oʻ / o' / o‘ / o`), «ё», знак «×» и слитное написание моделей.

const APOSTROPHES = /[ʻʼ‘’`'´]/g;

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/ё/g, 'е')
    .replace(/×/g, 'x')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Слова запроса (без дубликатов и однобуквенного мусора, кроме цифр). */
export function searchTokens(query: string): string[] {
  const tokens = normalizeSearchText(query)
    .split(' ')
    .filter((t) => t.length > 1 || /\d/.test(t));
  return [...new Set(tokens)];
}

/** Слитный вариант: «RTX 5070 Ti» ищется и как «rtx5070ti». */
export function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(/ /g, '');
}

/**
 * Синонимы категорий на обоих языках и в разговорной форме → тип товара.
 * Запрос «видюха 5070» ищет видеокарты со словом «5070».
 */
export const categorySynonyms: Record<string, string[]> = {
  gpu: [
    'видеокарта',
    'видеокарты',
    'видюха',
    'видеокарту',
    'videokarta',
    'videokartalar',
    'gpu',
    'graphics',
  ],
  cpu: ['процессор', 'процессоры', 'проц', 'protsessor', 'protsessorlar', 'cpu'],
  motherboard: ['материнка', 'материнская', 'мать', 'плата', 'ona', 'plata', 'motherboard'],
  ram: ['память', 'оперативка', 'озу', 'оперативная', 'xotira', 'operativ', 'ram', 'ddr4', 'ddr5'],
  storage: ['ssd', 'hdd', 'накопитель', 'диск', 'disk', 'nvme'],
  psu: ['блок', 'бп', 'питания', 'quvvat', 'psu'],
  case: ['корпус', 'korpus', 'case'],
  cooler: ['кулер', 'охлаждение', 'сжо', 'kuler', 'sovutish', 'cooler', 'aio'],
  case_fan: ['вентилятор', 'вентиляторы', 'ventilyator', 'fan'],
  monitor: ['монитор', 'monitor'],
  keyboard: ['клавиатура', 'klaviatura', 'keyboard'],
  mouse: ['мышь', 'мышка', 'sichqoncha', 'mouse'],
  headset: ['наушники', 'гарнитура', 'quloqchin', 'headset'],
  mousepad: ['коврик', 'gilamcha', 'mousepad'],
  webcam: ['вебкамера', 'камера', 'kamera', 'webcam'],
  prebuilt: ['готовый', 'сборка', 'компьютер', 'пк', 'kompyuter', 'tayyor'],
};

const synonymIndex = new Map<string, string>(
  Object.entries(categorySynonyms).flatMap(([type, words]) =>
    words.map((w) => [normalizeSearchText(w), type]),
  ),
);

/** Тип товара, на который явно указывает слово запроса. */
export function typeForToken(token: string): string | undefined {
  return synonymIndex.get(token);
}

/**
 * Текст поискового индекса товара: бренд, модель (раздельно и слитно), артикул,
 * названия категории на обоих языках и ключевые характеристики (сокет, чип, тип памяти).
 */
export function buildSearchText(parts: {
  brand: string;
  name: string;
  sku: string;
  keywords: string[];
}): string {
  return [
    normalizeSearchText(`${parts.brand} ${parts.name} ${parts.sku}`),
    compactSearchText(parts.name),
    compactSearchText(`${parts.brand}${parts.name}`),
    ...parts.keywords.map(normalizeSearchText),
  ]
    .filter(Boolean)
    .join(' ');
}
