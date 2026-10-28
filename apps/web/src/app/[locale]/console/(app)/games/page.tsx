import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { listGamesAdmin } from '@redcore/services';
import { CheckIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConsoleLink } from '@/features/console/console-base';
import { BenchmarkImport } from '@/features/console/game-form';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsoleGamesPage({ params }: PageProps<'/[locale]/console/games'>) {
  await requireStaff('games');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [t, tc, list] = await Promise.all([
    getTranslations({ locale, namespace: 'console.games' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listGamesAdmin(await getDb()),
  ]);
  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild size="sm">
            <ConsoleLink href="/games/new" data-testid="game-new">
              {t('new')}
            </ConsoleLink>
          </Button>
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-steel-400">{t('hint')}</p>
      <Panel title={t('import.title')}>
        <BenchmarkImport />
      </Panel>
      <DataTable
        testId="console-games"
        empty={tc('empty')}
        columns={[
          { key: 'name', label: t('cols.name') },
          { key: 'profile', label: t('cols.profile') },
          { key: 'alpha', label: t('cols.alpha'), align: 'right' },
          { key: 'bench', label: t('cols.bench'), align: 'right' },
          { key: 'active', label: t('cols.active') },
        ]}
        rows={list.map((g) => ({
          key: g.id,
          cells: {
            name: (
              <ConsoleLink
                href={`/games/${g.id}`}
                className="font-semibold hover:text-brand-bright"
              >
                {g.name}
                <span className="block font-mono text-xs font-normal text-steel-400">{g.slug}</span>
              </ConsoleLink>
            ),
            profile: t(`profiles.${g.profile}`),
            alpha: g.cpuAlpha.toFixed(2),
            bench: String(g.gpuFps['1440p'].ultra),
            active: g.isActive ? (
              <CheckIcon className="size-4 text-success" aria-label={t('cols.active')} />
            ) : null,
          },
        }))}
      />
    </>
  );
}
