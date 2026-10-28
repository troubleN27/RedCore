import {
  buildTotalUzs,
  placeProduct,
  type AnyCatalogProduct,
  type Build,
  type PerfIndex,
} from '../catalog';
import { computePower } from '../power';
import type { PcComponentType } from '../specs/enums';
import { rules } from './rules';
import type { BuildStatus, CompatIssue, CompatResult, Severity } from './types';

const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Обязательные слоты. Кулер — если у CPU нет боксового, видеокарта — если у CPU нет iGPU. */
export function missingSlots(build: Build): PcComponentType[] {
  const missing: PcComponentType[] = [];
  if (!build.case) missing.push('case');
  if (!build.motherboard) missing.push('motherboard');
  if (!build.cpu) missing.push('cpu');
  if (build.cpu && !build.cooler && !build.cpu.specs.includesCooler) missing.push('cooler');
  if (build.ram.length === 0) missing.push('ram');
  if (build.cpu && !build.gpu && !build.cpu.specs.integratedGraphics) missing.push('gpu');
  if (build.storage.length === 0) missing.push('storage');
  if (!build.psu) missing.push('psu');
  return missing;
}

function statusOf(issues: CompatIssue[], missing: PcComponentType[]): BuildStatus {
  if (issues.some((i) => i.severity === 'error')) return 'errors';
  if (missing.length > 0) return 'incomplete';
  if (issues.some((i) => i.severity === 'warning')) return 'warnings';
  return 'ok';
}

/** Полная проверка сборки в реальном времени: одинаково работает в браузере и на сервере. */
export function checkBuild(build: Build, perf?: PerfIndex): CompatResult {
  const power = computePower(build);
  const ctx = perf ? { build, power, perf } : { build, power };
  const issues = rules
    .flatMap((rule) => rule(ctx))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const missing = missingSlots(build);
  return {
    status: statusOf(issues, missing),
    issues,
    missing,
    power,
    totalUzs: buildTotalUzs(build),
  };
}

export interface CandidateVerdict {
  /** false — есть ошибка совместимости с уже выбранными деталями */
  compatible: boolean;
  /** Проблемы, которые появятся, если поставить этот товар (только касающиеся его слота) */
  issues: CompatIssue[];
}

/**
 * Оценка кандидата для списка в конфигураторе: «что будет, если выбрать этот товар».
 * Возвращаются только проблемы, затрагивающие слот кандидата.
 */
export function checkCandidate(
  build: Build,
  candidate: AnyCatalogProduct,
  perf?: PerfIndex,
): CandidateVerdict {
  const slot = candidate.componentType as PcComponentType;
  const result = checkBuild(placeProduct(build, candidate), perf);
  const issues = result.issues.filter((i) => i.slots.includes(slot));
  return { compatible: !issues.some((i) => i.severity === 'error'), issues };
}
