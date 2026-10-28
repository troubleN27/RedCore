/** Основные разделы шапки. Подписи — ключи словаря nav. */
export const navItems = [
  { href: '/catalog', key: 'catalog' },
  { href: '/configurator', key: 'configurator' },
  { href: '/fps', key: 'fps' },
  { href: '/prebuilt', key: 'prebuilt' },
] as const;

export type NavKey = (typeof navItems)[number]['key'];
