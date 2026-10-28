import { Inter, JetBrains_Mono, Unbounded } from 'next/font/google';

// Заголовки — широкий спортивный гротеск, текст — Inter (кириллица и узбекская ʻ U+02BB),
// характеристики и SKU — моноширинный.
const display = Unbounded({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-unbounded',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
