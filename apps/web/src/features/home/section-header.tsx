import { ArrowRightIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Link } from '@/i18n/navigation';

/** Секция главной: одинаковая ширина и отступ сверху у всех секций */
export const homeSection = 'mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:mt-20 lg:px-8';

/** Заголовок секции главной: название, подзаголовок и ссылка справа */
export function SectionHeader({
  title,
  subtitle,
  link,
  id,
}: {
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
  id?: string;
}) {
  return (
    <Reveal className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2
          id={id}
          className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl"
        >
          {title}
        </h2>
        {subtitle && <p className="text-sm text-pretty text-steel-400">{subtitle}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-bright hover:underline"
        >
          {link.label}
          <ArrowRightIcon className="size-4" />
        </Link>
      )}
    </Reveal>
  );
}
