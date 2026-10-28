/** Демо-отзывы: опубликованные и ждущие модерации (для очереди в админке). */
export const demoReviews: {
  slug: string;
  authorName: string;
  rating: number;
  text: string;
  pros?: string;
  cons?: string;
  locale: 'ru' | 'uz';
  status: 'approved' | 'pending';
}[] = [
  {
    slug: 'amd-ryzen-7-9800x3d',
    authorName: 'Тимур',
    rating: 5,
    text: 'Лучший игровой процессор, который у меня был. В CS2 и Cyberpunk прирост к старому 5800X огромный.',
    pros: 'Производительность в играх, холодный под башней',
    cons: 'Цена',
    locale: 'ru',
    status: 'approved',
  },
  {
    slug: 'amd-ryzen-7-9800x3d',
    authorName: 'Jasur',
    rating: 5,
    text: 'Oʻyinlarda juda tez. Doʻkonda BIOS ni yangilab, yigʻib berishdi.',
    pros: 'Tezlik, sovuq ishlaydi',
    locale: 'uz',
    status: 'approved',
  },
  {
    slug: 'amd-ryzen-7-9800x3d',
    authorName: 'Олег',
    rating: 4,
    text: 'Отличный камень, но без хорошего кулера не обойтись.',
    locale: 'ru',
    status: 'pending',
  },
  {
    slug: 'msi-mag-b850-tomahawk-max-wifi',
    authorName: 'Диана',
    rating: 5,
    text: 'Стабильная плата, BIOS удобный, Wi-Fi 7 ловит через две стены.',
    pros: 'VRM, разъёмы M.2',
    locale: 'ru',
    status: 'approved',
  },
  {
    slug: 'msi-mag-b850-tomahawk-max-wifi',
    authorName: 'Sardor',
    rating: 3,
    text: 'Yaxshi plata, lekin RGB dasturi noqulay.',
    locale: 'uz',
    status: 'pending',
  },
];
