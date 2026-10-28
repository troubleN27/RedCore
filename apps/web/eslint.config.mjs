import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';

// Технические атрибуты, где литералы — не пользовательский текст.
const technicalAttributes = [
  'className',
  'style',
  'type',
  'key',
  'id',
  'width',
  'height',
  'href',
  'src',
  'rel',
  'target',
  'role',
  'lang',
  'hrefLang',
  'variant',
  'size',
  'side',
  'align',
  'sizes',
  'name',
  'htmlFor',
  'method',
  'action',
  'as',
  'mode',
  'xmlns',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'transform',
  'points',
  'x',
  'y',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'x2',
  'y1',
  'y2',
  'offset',
  'stopColor',
  'stopOpacity',
  'gradientUnits',
  'gradientTransform',
  'preserveAspectRatio',
  'clipPath',
  'fillRule',
  'clipRule',
  'opacity',
  'aria-hidden',
  'aria-current',
  'aria-pressed',
  'aria-expanded',
  'aria-controls',
  'aria-labelledby',
  'aria-describedby',
  'aria-live',
  'data-.*',
  'inputMode',
  'autoComplete',
  'dir',
  'tabIndex',
  'loading',
  'decoding',
  'fetchPriority',
  'orientation',
  'dateTime',
  'scope',
  'translate',
  'spellCheck',
  'enterKeyHint',
  'patternUnits',
  'radius',
  'position',
  'theme',
  'tone',
  // пропсы консоли: идентификатор для тестов и путь внутри секретного префикса
  'testId',
  'basePath',
  // ключ данных графика Recharts
  'dataKey',
  // value у радиокнопок и вкладок — идентификатор варианта
  'value',
  // пропсы-ключи: значение — ключ словаря или идентификатор, а не текст
  'section',
  'slot',
  'icon',
];

// Переводчики next-intl (t, tc, tn…) и их методы; плюс стандартные исключения плагина —
// опции плагина сливаются поверхностно, поэтому дефолты нужно повторить.
const translatorCallees = [
  't[a-z]?',
  't[a-z]?\\.(rich|markup|raw|has)',
  'i18n(ext)?',
  'require',
  'addEventListener',
  'removeEventListener',
  'postMessage',
  'getElementById',
  'dispatch',
  'commit',
  'includes',
  'indexOf',
  'endsWith',
  'startsWith',
  'cn',
  'cva',
  // URL-параметры каталога: ключи фильтров — не пользовательский текст
  'params\.(get|set|delete|has|append)',
  'toggle\w*',
  // ключ поля формы для сообщения об ошибке
  'show',
  // server actions и пути консоли получают идентификаторы, а не текст
  '[a-zA-Z]+Action',
  'href',
  // поле формы промокода: ключ состояния и тип input
  'field',
  // сеттеры состояния: аргумент — ключ поля или шага
  'set(Step|[A-Z]\w*)?',
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  i18next.configs['flat/recommended'],
  {
    rules: {
      // Весь пользовательский текст — только из словарей @redcore/i18n (RU/UZ).
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { exclude: technicalAttributes },
          callees: { exclude: translatorCallees },
          // href и т.п. в объектах (хлебные крошки, пункты меню) — пути, а не текст
          // и опции Intl/Stripe Appearance — форматы и цвета, а не текст
          'object-properties': {
            exclude: [
              '[A-Z_-]+',
              'href',
              'key',
              'kind',
              'slug',
              'value',
              'align',
              '(date|time)Style',
              'hour|minute|day|month|year',
              'theme|layout|color[A-Za-z]+|fontFamily|borderRadius',
            ],
          },
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Примитивы shadcn/ui и 3D-сцены (геометрия, цвета, режимы рендера) — без пользовательских строк.
    files: ['src/components/ui/**', 'src/three/**'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
