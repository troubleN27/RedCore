import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import { listGamesAdmin, type GameInput } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { GameForm } from '@/features/console/game-form';
import { PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

const quad = (v: number) => ({ low: v, medium: v, high: v, ultra: v });

/** Пустая форма новой игры: числа не заполнены — сохранение без замеров не пройдёт. */
const EMPTY: GameInput = {
  slug: '',
  name: '',
  steamAppId: null,
  coverUrl: null,
  hue: 0,
  profile: 'aaa',
  cpuAlpha: 0.8,
  vendorBias: {},
  ramMinGb: 16,
  ramRecGb: 16,
  supports: { dlss: true, fsr: true, xess: true, frameGen: true },
  thresholds: { good: 60, playable: 30 },
  lowRatio: 0.78,
  fpsCap: null,
  isActive: true,
  sort: 100,
  gpuFps: { '1080p': quad(NaN), '1440p': quad(NaN), '2160p': quad(NaN) },
  vramGb: { '1080p': quad(NaN), '1440p': quad(NaN), '2160p': quad(NaN) },
  cpuFps: quad(NaN),
};

export default async function ConsoleGamePage({
  params,
}: PageProps<'/[locale]/console/games/[id]'>) {
  await requireStaff('games');
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'console.games' });
  const isNew = id === 'new';
  const game = isNew ? null : (await listGamesAdmin(await getDb())).find((g) => g.id === id);
  if (!isNew && !game) notFound();

  const initial: GameInput = game
    ? {
        slug: game.slug,
        name: game.name,
        steamAppId: game.steamAppId,
        coverUrl: game.coverUrl,
        hue: game.hue,
        profile: game.profile,
        cpuAlpha: game.cpuAlpha,
        vendorBias: game.vendorBias,
        ramMinGb: game.ramMinGb,
        ramRecGb: game.ramRecGb,
        supports: game.supports,
        thresholds: game.thresholds,
        lowRatio: game.lowRatio,
        fpsCap: game.fpsCap,
        isActive: game.isActive,
        sort: game.sort,
        gpuFps: game.gpuFps,
        vramGb: game.vramGb,
        cpuFps: game.cpuFps,
      }
    : EMPTY;

  return (
    <>
      <PageHeader title={game ? t('edit', { name: game.name }) : t('new')} />
      <Panel title={t('hint')}>
        <GameForm id={game?.id ?? null} initial={initial} />
      </Panel>
    </>
  );
}
