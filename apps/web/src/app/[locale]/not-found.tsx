import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors.notFound');
  const tc = useTranslations('common');

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      <p className="text-gradient-red font-display text-7xl font-black tracking-tighter sm:text-8xl">
        {t('code')}
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
      <p className="max-w-md text-steel-300">{t('text')}</p>
      <Button asChild>
        <Link href="/">{tc('actions.toHome')}</Link>
      </Button>
    </section>
  );
}
