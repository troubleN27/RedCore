import type { Build, PerfIndex } from '../catalog';
import type { PowerReport } from '../power';
import type { PcComponentType } from '../specs/enums';
import type { CompatCode, CompatIssue, IssueParams, Severity } from './types';

export interface RuleContext {
  build: Build;
  power: PowerReport;
  perf?: PerfIndex;
}

type Rule = (ctx: RuleContext) => CompatIssue[];

function issue(
  code: CompatCode,
  severity: Severity,
  slots: PcComponentType[],
  params?: IssueParams,
): CompatIssue {
  return params ? { code, severity, slots, params } : { code, severity, slots };
}

/** Толщина радиатора СЖО с вентиляторами — столько он «съедает» от длины видеокарты спереди. */
export const FRONT_RADIATOR_CLEARANCE_MM = 55;
/** Сколько 8-pin нужно адаптеру 12V-2x6 в зависимости от TBP видеокарты */
export function adapterPcie8Needed(tbpW: number): number {
  if (tbpW > 450) return 4;
  if (tbpW > 300) return 3;
  return 2;
}
/** Минимальный игровой индекс CPU, чтобы не ограничивать GPU с индексом g (в 1440p) */
export function requiredCpuIndex(gpuIndex1440: number): number {
  return 0.3 + 0.3 * gpuIndex1440;
}

/** Все радиаторы, которые физически ставятся в корпус, по позициям. */
function radiatorPositionsFor(build: Build, radiatorMm: number): string[] {
  const radiators = build.case?.specs.radiators;
  if (!radiators) return [];
  return Object.entries(radiators)
    .filter(([, sizes]) => (sizes as number[]).includes(radiatorMm))
    .map(([position]) => position);
}

const ramTotals = (build: Build) => {
  let modules = 0;
  let capacityGb = 0;
  let maxHeightMm = 0;
  let maxSpeed = 0;
  for (const line of build.ram) {
    modules += line.product.specs.modules * line.qty;
    capacityGb += line.product.specs.capacityGb * line.qty;
    maxHeightMm = Math.max(maxHeightMm, line.product.specs.heightMm);
    maxSpeed = Math.max(maxSpeed, line.product.specs.speedMts);
  }
  return { modules, capacityGb, maxHeightMm, maxSpeed };
};

// ── CPU ↔ материнская плата ──

const cpuBoard: Rule = ({ build: { cpu, motherboard } }) => {
  if (!cpu || !motherboard) return [];
  const slots: PcComponentType[] = ['cpu', 'motherboard'];
  if (cpu.specs.socket !== motherboard.specs.socket) {
    return [
      issue('cpu.socketMismatch', 'error', slots, {
        cpuSocket: cpu.specs.socket,
        boardSocket: motherboard.specs.socket,
      }),
    ];
  }
  if (!motherboard.specs.supportedFamilies.includes(cpu.specs.family)) {
    return [issue('cpu.familyUnsupported', 'error', slots, { chipset: motherboard.specs.chipset })];
  }
  if (motherboard.specs.biosUpdateRequiredFor.includes(cpu.specs.family)) {
    return [issue('cpu.biosUpdate', 'warning', slots, { chipset: motherboard.specs.chipset })];
  }
  return [];
};

// ── Память ──

const memory: Rule = ({ build }) => {
  const { ram, motherboard, cpu } = build;
  if (ram.length === 0) return [];
  const out: CompatIssue[] = [];
  const totals = ramTotals(build);
  const types = new Set(ram.map((line) => line.product.specs.type));

  if (motherboard) {
    for (const type of types) {
      if (type !== motherboard.specs.memoryType) {
        out.push(
          issue('ram.typeMismatchBoard', 'error', ['ram', 'motherboard'], {
            ramType: type,
            boardType: motherboard.specs.memoryType,
          }),
        );
      }
    }
    if (totals.modules > motherboard.specs.memorySlots) {
      out.push(
        issue('ram.slotsExceeded', 'error', ['ram', 'motherboard'], {
          modules: totals.modules,
          slots: motherboard.specs.memorySlots,
        }),
      );
    }
    if (totals.modules === 1 && motherboard.specs.memorySlots >= 2) {
      out.push(issue('ram.singleChannel', 'warning', ['ram']));
    }
  }
  if (cpu) {
    for (const type of types) {
      if (!cpu.specs.memoryTypes.includes(type)) {
        out.push(issue('ram.typeMismatchCpu', 'error', ['ram', 'cpu'], { ramType: type }));
      }
    }
  }

  const limits = [motherboard?.specs.maxMemoryGb, cpu?.specs.maxMemoryGb].filter(
    (v): v is number => v !== undefined,
  );
  if (limits.length > 0 && totals.capacityGb > Math.min(...limits)) {
    out.push(
      issue('ram.capacityExceeded', 'error', ['ram'], {
        totalGb: totals.capacityGb,
        maxGb: Math.min(...limits),
      }),
    );
  }

  const speedLimits = [motherboard?.specs.maxMemorySpeedMts].filter(
    (v): v is number => v !== undefined,
  );
  if (speedLimits.length > 0 && totals.maxSpeed > Math.min(...speedLimits)) {
    out.push(
      issue('ram.speedDowngrade', 'info', ['ram', 'motherboard'], {
        speed: totals.maxSpeed,
        maxSpeed: Math.min(...speedLimits),
      }),
    );
  }

  if (new Set(ram.map((line) => line.product.id)).size > 1) {
    out.push(issue('ram.mixedKits', 'warning', ['ram']));
  }
  if (types.has('DDR5') && totals.modules >= 4) {
    out.push(issue('ram.fourDimmDdr5', 'info', ['ram']));
  }
  return out;
};

// ── Корпус: плата, видеокарта, кулер ──

const caseFit: Rule = ({ build }) => {
  const { case: pcCase, motherboard, gpu, cooler } = build;
  if (!pcCase) return [];
  const out: CompatIssue[] = [];

  if (motherboard && !pcCase.specs.supportedMotherboards.includes(motherboard.specs.formFactor)) {
    out.push(
      issue('case.motherboardFormFactor', 'error', ['case', 'motherboard'], {
        formFactor: motherboard.specs.formFactor,
      }),
    );
  }

  if (gpu) {
    // Если СЖО ставится только во фронт, радиатор отнимает место у видеокарты
    let maxGpuMm = pcCase.specs.maxGpuLengthMm;
    const slots: PcComponentType[] = ['gpu', 'case'];
    if (cooler?.specs.kind === 'aio') {
      const positions = radiatorPositionsFor(build, cooler.specs.radiatorMm);
      if (positions.length === 1 && positions[0] === 'front') {
        maxGpuMm -= FRONT_RADIATOR_CLEARANCE_MM;
        slots.push('cooler');
      }
    }
    if (gpu.specs.lengthMm > maxGpuMm) {
      out.push(
        issue('gpu.tooLong', 'error', slots, { lengthMm: gpu.specs.lengthMm, maxMm: maxGpuMm }),
      );
    }
    const maxSlots = pcCase.specs.maxGpuSlots ?? pcCase.specs.expansionSlots;
    if (gpu.specs.slotWidth > maxSlots) {
      out.push(
        issue('gpu.tooThick', 'error', ['gpu', 'case'], {
          slots: gpu.specs.slotWidth,
          maxSlots,
        }),
      );
    }
  }

  if (cooler?.specs.kind === 'air' && cooler.specs.heightMm > pcCase.specs.maxCoolerHeightMm) {
    out.push(
      issue('cooler.tooTall', 'error', ['cooler', 'case'], {
        heightMm: cooler.specs.heightMm,
        maxMm: pcCase.specs.maxCoolerHeightMm,
      }),
    );
  }
  if (
    cooler?.specs.kind === 'aio' &&
    radiatorPositionsFor(build, cooler.specs.radiatorMm).length === 0
  ) {
    out.push(
      issue('cooler.radiatorUnsupported', 'error', ['cooler', 'case'], {
        radiatorMm: cooler.specs.radiatorMm,
      }),
    );
  }
  return out;
};

// ── Охлаждение CPU ──

const cooling: Rule = ({ build }) => {
  const { cpu, cooler } = build;
  if (!cpu) return [];
  if (!cooler) {
    return cpu.specs.includesCooler ? [issue('cooler.boxed', 'info', ['cooler', 'cpu'])] : [];
  }
  const out: CompatIssue[] = [];
  if (!cooler.specs.sockets.includes(cpu.specs.socket)) {
    out.push(
      issue('cooler.socketUnsupported', 'error', ['cooler', 'cpu'], { socket: cpu.specs.socket }),
    );
  }
  const params = { ratingW: cooler.specs.tdpRatingW, cpuW: cpu.specs.maxPowerW };
  if (cooler.specs.tdpRatingW < cpu.specs.tdpW) {
    out.push(issue('cooler.insufficient', 'error', ['cooler', 'cpu'], params));
  } else if (cooler.specs.tdpRatingW < cpu.specs.maxPowerW * 0.85) {
    out.push(issue('cooler.weak', 'warning', ['cooler', 'cpu'], params));
  }
  if (
    cooler.specs.kind === 'air' &&
    cooler.specs.ramClearanceMm !== undefined &&
    build.ram.length > 0
  ) {
    const { maxHeightMm } = ramTotals(build);
    if (maxHeightMm > cooler.specs.ramClearanceMm) {
      out.push(
        issue('cooler.ramClearance', 'warning', ['cooler', 'ram'], {
          ramHeightMm: maxHeightMm,
          clearanceMm: cooler.specs.ramClearanceMm,
        }),
      );
    }
  }
  return out;
};

// ── Накопители ──

const storage: Rule = ({ build }) => {
  const { storage: drives, motherboard, case: pcCase } = build;
  if (drives.length === 0) return [];
  const out: CompatIssue[] = [];
  const count = (predicate: (kind: string, formFactor: string) => boolean) =>
    drives
      .filter((line) => predicate(line.product.specs.kind, line.product.specs.formFactor))
      .reduce((sum, line) => sum + line.qty, 0);

  const m2Count = count((kind) => kind === 'nvme');
  const sataCount = count((kind) => kind !== 'nvme');

  if (motherboard) {
    const slots = motherboard.specs.m2Slots;
    if (m2Count > slots.length) {
      out.push(
        issue('storage.m2SlotsExceeded', 'error', ['storage', 'motherboard'], {
          count: m2Count,
          slots: slots.length,
        }),
      );
    }
    const bestGen = Math.max(...slots.map((slot) => slot.gen));
    const fastest = drives.find((line) => line.product.specs.interface === 'pcie5' && bestGen < 5);
    if (fastest) {
      out.push(
        issue('storage.m2GenDowngrade', 'info', ['storage', 'motherboard'], { gen: bestGen }),
      );
    }
    if (sataCount > motherboard.specs.sataPorts) {
      out.push(
        issue('storage.sataPortsExceeded', 'error', ['storage', 'motherboard'], {
          count: sataCount,
          ports: motherboard.specs.sataPorts,
        }),
      );
    }
  }

  if (pcCase) {
    const hdd35 = count((kind, ff) => kind === 'hdd' && ff === '3.5');
    const drives25 = count((kind, ff) => kind !== 'nvme' && ff === '2.5');
    if (hdd35 > pcCase.specs.bays35) {
      out.push(
        issue('storage.bays35Exceeded', 'error', ['storage', 'case'], {
          count: hdd35,
          bays: pcCase.specs.bays35,
        }),
      );
    }
    // 2.5" ставятся и в свободные 3.5" отсеки
    const free35 = Math.max(0, pcCase.specs.bays35 - hdd35);
    if (drives25 > pcCase.specs.bays25 + free35) {
      out.push(
        issue('storage.bays25Exceeded', 'error', ['storage', 'case'], {
          count: drives25,
          bays: pcCase.specs.bays25 + free35,
        }),
      );
    }
  }
  return out;
};

// ── Блок питания ──

const psu: Rule = ({ build, power }) => {
  const { psu: unit, gpu, case: pcCase } = build;
  if (!unit) return [];
  const out: CompatIssue[] = [];
  const watts = unit.specs.wattage;

  if (power.loadW > watts) {
    out.push(issue('psu.insufficient', 'error', ['psu'], { loadW: power.loadW, psuW: watts }));
  } else if (power.recommendedPsuW > watts) {
    out.push(
      issue('psu.belowRecommended', 'warning', ['psu'], {
        recommendedW: power.recommendedPsuW,
        psuW: watts,
      }),
    );
  }

  if (gpu) {
    const need = gpu.specs.powerConnectors;
    const have = unit.specs.connectors;
    if (need.h12v2x6 > 0 && have.h12v2x6 < need.h12v2x6) {
      const pcie8Needed = adapterPcie8Needed(gpu.specs.tbpW) * need.h12v2x6;
      out.push(
        have.pcie8 >= pcie8Needed
          ? issue('psu.gpuAdapterRequired', 'warning', ['psu', 'gpu'], { pcie8: pcie8Needed })
          : issue('psu.gpuConnectorsMissing', 'error', ['psu', 'gpu'], { connector: '12V-2x6' }),
      );
    }
    if (need.pcie8 > have.pcie8) {
      out.push(
        issue('psu.gpuConnectorsMissing', 'error', ['psu', 'gpu'], {
          connector: `${need.pcie8}× PCIe 8-pin`,
        }),
      );
    }
  }

  if (pcCase) {
    if (!pcCase.specs.psuFormFactors.includes(unit.specs.formFactor)) {
      out.push(
        issue('psu.formFactor', 'error', ['psu', 'case'], { formFactor: unit.specs.formFactor }),
      );
    } else if (unit.specs.lengthMm > pcCase.specs.maxPsuLengthMm) {
      out.push(
        issue('psu.tooLong', 'error', ['psu', 'case'], {
          lengthMm: unit.specs.lengthMm,
          maxMm: pcCase.specs.maxPsuLengthMm,
        }),
      );
    }
  }
  return out;
};

// ── Корпусные вентиляторы ──

const fans: Rule = ({ build }) => {
  const { case_fan: lines, case: pcCase, motherboard, cooler } = build;
  if (lines.length === 0) return [];
  const out: CompatIssue[] = [];
  const added = lines.reduce((sum, line) => sum + line.product.specs.packCount * line.qty, 0);

  if (pcCase) {
    for (const line of lines) {
      if (!pcCase.specs.fanSizes.includes(line.product.specs.sizeMm)) {
        out.push(
          issue('fans.sizeUnsupported', 'error', ['case_fan', 'case'], {
            sizeMm: line.product.specs.sizeMm,
          }),
        );
      }
    }
    const radiatorFans = cooler?.specs.kind === 'aio' ? cooler.specs.fans : 0;
    const total = added + pcCase.specs.includedFans + radiatorFans;
    if (total > pcCase.specs.fanSlots) {
      out.push(
        issue('fans.slotsExceeded', 'warning', ['case_fan', 'case'], {
          count: total,
          slots: pcCase.specs.fanSlots,
        }),
      );
    }
  }
  if (motherboard && added > motherboard.specs.fanHeaders) {
    out.push(
      issue('fans.headersExceeded', 'info', ['case_fan', 'motherboard'], {
        count: added,
        headers: motherboard.specs.fanHeaders,
      }),
    );
  }
  return out;
};

// ── Видеовыход и производительность ──

const graphics: Rule = ({ build, perf }) => {
  const { cpu, gpu, motherboard } = build;
  const out: CompatIssue[] = [];
  if (cpu && !gpu && !cpu.specs.integratedGraphics) {
    out.push(issue('gpu.noDisplayOutput', 'warning', ['gpu', 'cpu']));
  }
  if (
    gpu &&
    motherboard &&
    gpu.specs.pcieLanes <= 8 &&
    motherboard.specs.pcieGen < gpu.specs.pcieGen
  ) {
    out.push(
      issue('perf.pcieBandwidth', 'info', ['gpu', 'motherboard'], {
        lanes: gpu.specs.pcieLanes,
        boardGen: motherboard.specs.pcieGen,
      }),
    );
  }
  const gpuPerf = gpu ? perf?.gpu[gpu.specs.chip] : undefined;
  if (gpu && gpuPerf && gpu.specs.vramGb <= 8 && gpuPerf.index1440 >= 0.6) {
    out.push(issue('perf.vramLimited', 'info', ['gpu'], { vramGb: gpu.specs.vramGb }));
  }
  const cpuPerf = cpu?.perfKey ? perf?.cpu[cpu.perfKey] : undefined;
  if (gpuPerf && cpuPerf) {
    const required = requiredCpuIndex(gpuPerf.index1440);
    if (cpuPerf.gamingIndex < required * 0.9) {
      out.push(
        issue('perf.cpuBottleneck', 'warning', ['cpu', 'gpu'], {
          lossPercent: Math.round((1 - cpuPerf.gamingIndex / required) * 100),
        }),
      );
    }
  }
  return out;
};

const balance: Rule = ({ build }) => {
  const out: CompatIssue[] = [];
  if (build.ram.length > 0) {
    const { capacityGb } = ramTotals(build);
    if (capacityGb < 16)
      out.push(issue('perf.lowRam', 'warning', ['ram'], { totalGb: capacityGb }));
  }
  if (
    build.storage.length > 0 &&
    build.storage.every((line) => line.product.specs.kind === 'hdd')
  ) {
    out.push(issue('perf.hddSystemDrive', 'warning', ['storage']));
  }
  return out;
};

export const rules: Rule[] = [
  cpuBoard,
  memory,
  caseFit,
  cooling,
  storage,
  psu,
  fans,
  graphics,
  balance,
];
