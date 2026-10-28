import { notFound } from 'next/navigation';

// Любой неизвестный путь внутри локали отдаёт локализованную 404 с шапкой и подвалом.
export default function CatchAllPage() {
  notFound();
}
