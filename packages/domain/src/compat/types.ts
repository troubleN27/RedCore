import type { PowerReport } from '../power';
import type { PcComponentType } from '../specs/enums';

/**
 * Коды проблем совместимости. Текст на RU/UZ — в @redcore/i18n: compat.<code>
 * (например, compat.cpu.socketMismatch), параметры подставляются через ICU.
 */
export const compatCodes = [
  'cpu.socketMismatch',
  'cpu.familyUnsupported',
  'cpu.biosUpdate',
  'ram.typeMismatchBoard',
  'ram.typeMismatchCpu',
  'ram.slotsExceeded',
  'ram.capacityExceeded',
  'ram.speedDowngrade',
  'ram.singleChannel',
  'ram.mixedKits',
  'ram.fourDimmDdr5',
  'case.motherboardFormFactor',
  'gpu.tooLong',
  'gpu.tooThick',
  'gpu.noDisplayOutput',
  'cooler.tooTall',
  'cooler.socketUnsupported',
  'cooler.insufficient',
  'cooler.weak',
  'cooler.radiatorUnsupported',
  'cooler.ramClearance',
  'cooler.boxed',
  'storage.m2SlotsExceeded',
  'storage.m2GenDowngrade',
  'storage.sataPortsExceeded',
  'storage.bays25Exceeded',
  'storage.bays35Exceeded',
  'psu.insufficient',
  'psu.belowRecommended',
  'psu.gpuConnectorsMissing',
  'psu.gpuAdapterRequired',
  'psu.formFactor',
  'psu.tooLong',
  'fans.sizeUnsupported',
  'fans.slotsExceeded',
  'fans.headersExceeded',
  'perf.cpuBottleneck',
  'perf.pcieBandwidth',
  'perf.vramLimited',
  'perf.lowRam',
  'perf.hddSystemDrive',
] as const;

export type CompatCode = (typeof compatCodes)[number];

export type Severity = 'error' | 'warning' | 'info';

export type IssueParams = Record<string, string | number>;

export interface CompatIssue {
  code: CompatCode;
  severity: Severity;
  /** Слоты, к которым относится проблема — по ним подсвечиваются детали в UI и 3D */
  slots: PcComponentType[];
  params?: IssueParams;
}

/**
 * incomplete — не хватает обязательных деталей (ошибок нет),
 * errors — есть несовместимость, warnings — собрать можно, но есть замечания.
 */
export type BuildStatus = 'incomplete' | 'errors' | 'warnings' | 'ok';

export interface CompatResult {
  status: BuildStatus;
  issues: CompatIssue[];
  /** Обязательные слоты, которые ещё не заполнены */
  missing: PcComponentType[];
  power: PowerReport;
  totalUzs: number;
}
