import type { Database } from '@redcore/db';
import { calibrateFps, parseFpsCsv, type CalibrationResult } from '@redcore/domain';
import { applyCalibration, getFpsData, invalidateFpsCache } from '@redcore/services';

/** Калибровка по CSV замеров против текущих игр и индексов в базе. */
export async function runCalibration(
  db: Database,
  csv: string,
  options: { apply?: boolean } = {},
): Promise<CalibrationResult> {
  invalidateFpsCache();
  const data = await getFpsData(db);
  const result = calibrateFps(
    parseFpsCsv(csv),
    data.games,
    Object.fromEntries(data.gpus.map((g) => [g.key, g])),
    Object.fromEntries(data.cpus.map((c) => [c.key, c])),
    data.model,
  );
  if (options.apply) await applyCalibration(db, result);
  return result;
}
