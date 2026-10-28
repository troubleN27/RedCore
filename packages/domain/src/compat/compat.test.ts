import { describe, expect, it } from 'vitest';
import { emptyBuild, removeFromSlot, type Build } from '../catalog';
import {
  aio,
  airCooler,
  caseFan,
  completeBuild,
  cpu,
  gpu,
  hdd,
  motherboard,
  pcCase,
  perf,
  psu,
  ram,
  sataSsd,
  storage,
  withPart,
} from '../test/fixtures';
import { checkBuild, checkCandidate, missingSlots } from './engine';
import { adapterPcie8Needed, requiredCpuIndex } from './rules';
import type { CompatCode } from './types';

const codes = (build: Build) => checkBuild(build, perf).issues.map((i) => i.code);
const issueOf = (build: Build, code: CompatCode) =>
  checkBuild(build, perf).issues.find((i) => i.code === code);
const expectIssue = (build: Build, code: CompatCode, severity: 'error' | 'warning' | 'info') => {
  const found = issueOf(build, code);
  expect(found, `ожидалась проблема ${code}`).toBeDefined();
  expect(found?.severity).toBe(severity);
  return found!;
};
const expectNo = (build: Build, code: CompatCode) => expect(codes(build)).not.toContain(code);

describe('базовая сборка', () => {
  it('полностью совместима и без замечаний', () => {
    const result = checkBuild(completeBuild(), perf);
    expect(result.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
  });

  it('пустая сборка — incomplete, без ошибок', () => {
    const result = checkBuild(emptyBuild());
    expect(result.status).toBe('incomplete');
    expect(result.issues).toEqual([]);
    expect(result.totalUzs).toBe(0);
    expect(result.power.loadW).toBe(0);
  });

  it('считает итоговую сумму с количеством', () => {
    const build = withPart(completeBuild(), storage({}, { priceUzs: 500_000 }), 2);
    expect(checkBuild(build).totalUzs).toBe(8_000_000 + 1_000_000);
  });

  it('сортирует проблемы: ошибки, затем предупреждения, затем подсказки', () => {
    let build = withPart(completeBuild(), cpu({ socket: 'LGA1851', family: 'intel-ultra-200' }));
    build = withPart(build, ram({ capacityGb: 8, modules: 1 }));
    const severities = checkBuild(build, perf).issues.map((i) => i.severity);
    const order = { error: 0, warning: 1, info: 2 };
    expect([...severities].sort((a, b) => order[a] - order[b])).toEqual(severities);
  });
});

describe('CPU ↔ плата', () => {
  it('ошибка при разных сокетах', () => {
    const build = withPart(
      completeBuild(),
      cpu({ socket: 'LGA1700', family: 'intel-14', memoryTypes: ['DDR4', 'DDR5'] }),
    );
    const found = expectIssue(build, 'cpu.socketMismatch', 'error');
    expect(found.params).toEqual({ cpuSocket: 'LGA1700', boardSocket: 'AM5' });
    expect(found.slots).toEqual(['cpu', 'motherboard']);
  });

  it('нет ошибки при одинаковом сокете', () => expectNo(completeBuild(), 'cpu.socketMismatch'));

  it('ошибка, если чипсет не поддерживает семейство', () => {
    const build = withPart(completeBuild(), motherboard({ supportedFamilies: ['ryzen-7000'] }));
    expectIssue(build, 'cpu.familyUnsupported', 'error');
  });

  it('предупреждение об обновлении BIOS', () => {
    const build = withPart(
      completeBuild(),
      motherboard({ chipset: 'B650', biosUpdateRequiredFor: ['ryzen-9000'] }),
    );
    expect(expectIssue(build, 'cpu.biosUpdate', 'warning').params).toEqual({ chipset: 'B650' });
    expect(checkBuild(build, perf).status).toBe('warnings');
  });

  it('без BIOS-предупреждения для нативно поддерживаемого CPU', () =>
    expectNo(completeBuild(), 'cpu.biosUpdate'));

  it('несовпадение сокета не дублируется проверкой семейства', () => {
    const build = withPart(
      completeBuild(),
      cpu({ socket: 'AM4', family: 'ryzen-5000', memoryTypes: ['DDR4'] }),
    );
    expect(codes(build)).toContain('cpu.socketMismatch');
    expect(codes(build)).not.toContain('cpu.familyUnsupported');
  });
});

describe('память', () => {
  it('ошибка: DDR4 в плате DDR5', () => {
    const build = withPart(completeBuild(), ram({ type: 'DDR4', speedMts: 3200 }));
    expect(expectIssue(build, 'ram.typeMismatchBoard', 'error').params).toEqual({
      ramType: 'DDR4',
      boardType: 'DDR5',
    });
  });

  it('ошибка: процессор не поддерживает тип памяти', () => {
    let build = withPart(
      completeBuild(),
      motherboard({ memoryType: 'DDR4', maxMemorySpeedMts: 4800 }),
    );
    build = withPart(build, ram({ type: 'DDR4', speedMts: 3200 }));
    expectIssue(build, 'ram.typeMismatchCpu', 'error');
    expectNo(build, 'ram.typeMismatchBoard');
  });

  it('Intel LGA1700 поддерживает и DDR4, и DDR5', () => {
    let build = withPart(
      completeBuild(),
      cpu({ socket: 'LGA1700', family: 'intel-14', memoryTypes: ['DDR4', 'DDR5'] }),
    );
    build = withPart(
      build,
      motherboard({
        socket: 'LGA1700',
        chipset: 'B760',
        supportedFamilies: ['intel-12', 'intel-13', 'intel-14'],
        memoryType: 'DDR4',
        maxMemorySpeedMts: 4800,
      }),
    );
    build = withPart(build, ram({ type: 'DDR4', speedMts: 3200 }));
    expectNo(build, 'ram.typeMismatchCpu');
    expectNo(build, 'ram.typeMismatchBoard');
  });

  it('ошибка: модулей больше, чем слотов', () => {
    let build = withPart(completeBuild(), motherboard({ memorySlots: 2 }));
    build = withPart(build, ram({ capacityGb: 64, modules: 4 }));
    expect(expectIssue(build, 'ram.slotsExceeded', 'error').params).toEqual({
      modules: 4,
      slots: 2,
    });
  });

  it('два комплекта по 2 модуля занимают 4 слота без ошибки', () => {
    const kit = ram();
    const build = withPart(completeBuild(), kit, 2);
    expectNo(build, 'ram.slotsExceeded');
    expectIssue(build, 'ram.fourDimmDdr5', 'info');
  });

  it('ошибка: объём больше максимума платы или CPU', () => {
    let build = withPart(completeBuild(), motherboard({ memorySlots: 2, maxMemoryGb: 96 }));
    build = withPart(build, ram({ capacityGb: 128, modules: 2 }));
    expect(expectIssue(build, 'ram.capacityExceeded', 'error').params).toEqual({
      totalGb: 128,
      maxGb: 96,
    });
  });

  it('лимит объёма — минимум из платы и процессора', () => {
    let build = withPart(completeBuild(), cpu({ maxMemoryGb: 64 }));
    build = withPart(build, ram({ capacityGb: 96, modules: 2 }));
    expect(issueOf(build, 'ram.capacityExceeded')?.params?.maxGb).toBe(64);
  });

  it('подсказка: память быстрее, чем поддерживает плата', () => {
    let build = withPart(completeBuild(), motherboard({ maxMemorySpeedMts: 5600 }));
    build = withPart(build, ram({ speedMts: 7200 }));
    expect(expectIssue(build, 'ram.speedDowngrade', 'info').params).toEqual({
      speed: 7200,
      maxSpeed: 5600,
    });
  });

  it('без подсказки о частоте в пределах платы', () =>
    expectNo(completeBuild(), 'ram.speedDowngrade'));

  it('предупреждение: один модуль — одноканальный режим', () => {
    const build = withPart(completeBuild(), ram({ capacityGb: 16, modules: 1 }));
    expectIssue(build, 'ram.singleChannel', 'warning');
  });

  it('предупреждение: разные комплекты', () => {
    const build = completeBuild();
    build.ram = [...build.ram, { product: ram({ speedMts: 5600 }), qty: 1 }];
    expectIssue(build, 'ram.mixedKits', 'warning');
  });

  it('предупреждение: мало памяти', () => {
    const build = withPart(completeBuild(), ram({ capacityGb: 8, modules: 1 }));
    expect(expectIssue(build, 'perf.lowRam', 'warning').params).toEqual({ totalGb: 8 });
  });

  it('16 ГБ — достаточно, без предупреждения', () => {
    expectNo(withPart(completeBuild(), ram({ capacityGb: 16 })), 'perf.lowRam');
  });
});

describe('корпус', () => {
  it('ошибка: ATX-плата в ITX-корпусе', () => {
    const build = withPart(
      completeBuild(),
      pcCase({ formFactor: 'sff', supportedMotherboards: ['Mini-ITX'] }),
    );
    expect(expectIssue(build, 'case.motherboardFormFactor', 'error').params).toEqual({
      formFactor: 'ATX',
    });
  });

  it('mATX-плата в ATX-корпусе — совместимо', () => {
    expectNo(
      withPart(completeBuild(), motherboard({ formFactor: 'mATX' })),
      'case.motherboardFormFactor',
    );
  });

  it('ошибка: видеокарта длиннее допустимой', () => {
    const build = withPart(completeBuild(), gpu({ lengthMm: 357 }));
    const small = withPart(build, pcCase({ maxGpuLengthMm: 336 }));
    expect(expectIssue(small, 'gpu.tooLong', 'error').params).toEqual({
      lengthMm: 357,
      maxMm: 336,
    });
  });

  it('видеокарта ровно по максимуму — помещается', () => {
    const build = withPart(
      withPart(completeBuild(), gpu({ lengthMm: 380 })),
      pcCase({ maxGpuLengthMm: 380 }),
    );
    expectNo(build, 'gpu.tooLong');
  });

  it('фронтальная СЖО уменьшает место под видеокарту', () => {
    let build = withPart(
      completeBuild(),
      pcCase({ maxGpuLengthMm: 380, radiators: { front: [360], top: [240] } }),
    );
    build = withPart(build, aio({ radiatorMm: 360 }));
    build = withPart(build, gpu({ lengthMm: 340 }));
    const found = expectIssue(build, 'gpu.tooLong', 'error');
    expect(found.params?.maxMm).toBe(325);
    expect(found.slots).toContain('cooler');
  });

  it('СЖО сверху не мешает видеокарте', () => {
    let build = withPart(completeBuild(), pcCase({ maxGpuLengthMm: 380 }));
    build = withPart(build, aio({ radiatorMm: 360 }));
    build = withPart(build, gpu({ lengthMm: 370 }));
    expectNo(build, 'gpu.tooLong');
  });

  it('ошибка: слишком толстая видеокарта для SFF', () => {
    const build = withPart(
      withPart(completeBuild(), gpu({ slotWidth: 3.5 })),
      pcCase({ maxGpuSlots: 3, expansionSlots: 3 }),
    );
    expect(expectIssue(build, 'gpu.tooThick', 'error').params).toEqual({ slots: 3.5, maxSlots: 3 });
  });

  it('толщина ограничивается слотами расширения, если лимит не задан', () => {
    const build = withPart(
      withPart(completeBuild(), gpu({ slotWidth: 3 })),
      pcCase({ expansionSlots: 2 }),
    );
    expectIssue(build, 'gpu.tooThick', 'error');
  });

  it('обычная 2.5-слотовая карта в mid-tower — без ошибки', () =>
    expectNo(completeBuild(), 'gpu.tooThick'));
});

describe('охлаждение', () => {
  it('ошибка: кулер выше допустимого', () => {
    const build = withPart(completeBuild(), airCooler({ heightMm: 168 }));
    const small = withPart(build, pcCase({ maxCoolerHeightMm: 155 }));
    expect(expectIssue(small, 'cooler.tooTall', 'error').params).toEqual({
      heightMm: 168,
      maxMm: 155,
    });
  });

  it('высота кулера не проверяется для СЖО', () => {
    const build = withPart(withPart(completeBuild(), aio()), pcCase({ maxCoolerHeightMm: 60 }));
    expectNo(build, 'cooler.tooTall');
  });

  it('ошибка: кулер без поддержки сокета', () => {
    const build = withPart(completeBuild(), airCooler({ sockets: ['LGA1700'] }));
    expect(expectIssue(build, 'cooler.socketUnsupported', 'error').params).toEqual({
      socket: 'AM5',
    });
  });

  it('ошибка: кулер слабее TDP процессора', () => {
    let build = withPart(completeBuild(), cpu({ tdpW: 120, maxPowerW: 162 }));
    build = withPart(build, airCooler({ tdpRatingW: 95 }));
    expectIssue(build, 'cooler.insufficient', 'error');
  });

  it('предупреждение: кулер на пределе пиковой мощности', () => {
    let build = withPart(completeBuild(), cpu({ tdpW: 125, maxPowerW: 253 }));
    build = withPart(build, airCooler({ tdpRatingW: 180 }));
    expectIssue(build, 'cooler.weak', 'warning');
    expectNo(build, 'cooler.insufficient');
  });

  it('кулер с запасом — без замечаний', () => {
    expectNo(completeBuild(), 'cooler.weak');
    expectNo(completeBuild(), 'cooler.insufficient');
  });

  it('ошибка: радиатор не ставится в корпус', () => {
    let build = withPart(completeBuild(), pcCase({ radiators: { front: [240], top: [240] } }));
    build = withPart(build, aio({ radiatorMm: 360 }));
    expect(expectIssue(build, 'cooler.radiatorUnsupported', 'error').params).toEqual({
      radiatorMm: 360,
    });
  });

  it('радиатор 360 в корпусе с местом под 360 — совместимо', () => {
    expectNo(withPart(completeBuild(), aio({ radiatorMm: 360 })), 'cooler.radiatorUnsupported');
  });

  it('предупреждение: высокая память упирается в кулер', () => {
    let build = withPart(completeBuild(), airCooler({ ramClearanceMm: 32 }));
    build = withPart(build, ram({ heightMm: 44, rgb: true }));
    expect(expectIssue(build, 'cooler.ramClearance', 'warning').params).toEqual({
      ramHeightMm: 44,
      clearanceMm: 32,
    });
  });

  it('низкопрофильная память проходит под кулером', () => {
    let build = withPart(completeBuild(), airCooler({ ramClearanceMm: 40 }));
    build = withPart(build, ram({ heightMm: 34 }));
    expectNo(build, 'cooler.ramClearance');
  });

  it('боксовый кулер: подсказка и кулер не обязателен', () => {
    let build = withPart(completeBuild(), cpu({ includesCooler: true }));
    build = removeFromSlot(build, 'cooler');
    expectIssue(build, 'cooler.boxed', 'info');
    expect(missingSlots(build)).not.toContain('cooler');
  });

  it('без боксового кулера кулер обязателен', () => {
    const build = removeFromSlot(completeBuild(), 'cooler');
    expect(missingSlots(build)).toContain('cooler');
    expect(checkBuild(build).status).toBe('incomplete');
  });
});

describe('накопители', () => {
  it('ошибка: M.2 больше, чем слотов', () => {
    let build = withPart(
      completeBuild(),
      motherboard({ m2Slots: [{ gen: 4, maxLength: 2280, sata: false }] }),
    );
    build = withPart(build, storage({ capacityGb: 2000 }));
    expect(expectIssue(build, 'storage.m2SlotsExceeded', 'error').params).toEqual({
      count: 2,
      slots: 1,
    });
  });

  it('M.2 по числу слотов — без ошибки', () => {
    const build = withPart(
      withPart(completeBuild(), storage({ capacityGb: 2000 })),
      storage({ capacityGb: 4000 }),
    );
    expectNo(build, 'storage.m2SlotsExceeded');
  });

  it('подсказка: PCIe 5.0 накопитель в плате без Gen5-слота', () => {
    let build = withPart(
      completeBuild(),
      motherboard({
        m2Slots: [
          { gen: 4, maxLength: 2280, sata: false },
          { gen: 4, maxLength: 2280, sata: false },
        ],
      }),
    );
    build = withPart(build, storage({ interface: 'pcie5', readMbs: 14500 }));
    expect(expectIssue(build, 'storage.m2GenDowngrade', 'info').params).toEqual({ gen: 4 });
  });

  it('PCIe 5.0 накопитель в Gen5-слоте — без подсказки', () => {
    expectNo(withPart(completeBuild(), storage({ interface: 'pcie5' })), 'storage.m2GenDowngrade');
  });

  it('ошибка: SATA-устройств больше, чем портов', () => {
    let build = withPart(completeBuild(), motherboard({ sataPorts: 1 }));
    build = withPart(build, hdd(), 2);
    expectIssue(build, 'storage.sataPortsExceeded', 'error');
  });

  it('ошибка: не хватает 3,5″ отсеков', () => {
    let build = withPart(completeBuild(), pcCase({ bays35: 1 }));
    build = withPart(build, hdd(), 2);
    expect(expectIssue(build, 'storage.bays35Exceeded', 'error').params).toEqual({
      count: 2,
      bays: 1,
    });
  });

  it('2,5″ накопители занимают свободные 3,5″ отсеки', () => {
    let build = withPart(completeBuild(), pcCase({ bays25: 1, bays35: 1 }));
    build = withPart(build, sataSsd(), 2);
    expectNo(build, 'storage.bays25Exceeded');
  });

  it('ошибка: 2,5″ не во что ставить', () => {
    let build = withPart(completeBuild(), pcCase({ bays25: 1, bays35: 0 }));
    build = withPart(build, sataSsd(), 2);
    expectIssue(build, 'storage.bays25Exceeded', 'error');
  });

  it('предупреждение: только HDD в системе', () => {
    const build = { ...completeBuild(), storage: [{ product: hdd(), qty: 1 }] };
    expectIssue(build, 'perf.hddSystemDrive', 'warning');
  });

  it('SSD + HDD — без предупреждения', () => {
    expectNo(withPart(completeBuild(), hdd()), 'perf.hddSystemDrive');
  });
});

describe('блок питания', () => {
  it('ошибка: мощность меньше нагрузки', () => {
    let build = withPart(completeBuild(), gpu({ tbpW: 575, recommendedPsuW: 1000 }));
    build = withPart(build, psu({ wattage: 550 }));
    expectIssue(build, 'psu.insufficient', 'error');
  });

  it('предупреждение: мощность ниже рекомендованной', () => {
    let build = withPart(completeBuild(), gpu({ tbpW: 360, recommendedPsuW: 850 }));
    build = withPart(build, psu({ wattage: 650 }));
    const found = expectIssue(build, 'psu.belowRecommended', 'warning');
    expect(found.params?.recommendedW).toBe(850);
    expectNo(build, 'psu.insufficient');
  });

  it('с запасом — без замечаний', () => {
    expectNo(completeBuild(), 'psu.belowRecommended');
    expectNo(completeBuild(), 'psu.insufficient');
  });

  it('предупреждение: 12V-2x6 через адаптер, если хватает 8-pin', () => {
    const build = withPart(
      completeBuild(),
      psu({ connectors: { pcie8: 3, h12v2x6: 0, eps8: 2, sata: 6 } }),
    );
    expect(expectIssue(build, 'psu.gpuAdapterRequired', 'warning').params).toEqual({ pcie8: 2 });
  });

  it('ошибка: нет 12V-2x6 и не хватает 8-pin для адаптера', () => {
    let build = withPart(completeBuild(), gpu({ tbpW: 575, recommendedPsuW: 1000 }));
    build = withPart(
      build,
      psu({ wattage: 1200, connectors: { pcie8: 2, h12v2x6: 0, eps8: 2, sata: 6 } }),
    );
    expectIssue(build, 'psu.gpuConnectorsMissing', 'error');
  });

  it('ошибка: не хватает 8-pin для карты с классическим питанием', () => {
    let build = withPart(
      completeBuild(),
      gpu({
        vendor: 'amd',
        chip: 'rx-9070-xt',
        powerConnectors: { pcie8: 3, h12v2x6: 0 },
        tbpW: 304,
      }),
    );
    build = withPart(build, psu({ connectors: { pcie8: 2, h12v2x6: 1, eps8: 2, sata: 6 } }));
    expect(expectIssue(build, 'psu.gpuConnectorsMissing', 'error').params?.connector).toContain(
      '3',
    );
  });

  it('нативный 12V-2x6 — без замечаний по разъёмам', () => {
    expectNo(completeBuild(), 'psu.gpuAdapterRequired');
    expectNo(completeBuild(), 'psu.gpuConnectorsMissing');
  });

  it('ошибка: SFX-корпус не принимает ATX-блок', () => {
    const build = withPart(completeBuild(), pcCase({ psuFormFactors: ['SFX', 'SFX-L'] }));
    expect(expectIssue(build, 'psu.formFactor', 'error').params).toEqual({ formFactor: 'ATX' });
  });

  it('SFX-блок в ATX-корпусе — совместимо', () => {
    expectNo(
      withPart(completeBuild(), psu({ formFactor: 'SFX', lengthMm: 100 })),
      'psu.formFactor',
    );
  });

  it('ошибка: блок питания длиннее допустимого', () => {
    const build = withPart(
      withPart(completeBuild(), psu({ lengthMm: 200 })),
      pcCase({ maxPsuLengthMm: 160 }),
    );
    expectIssue(build, 'psu.tooLong', 'error');
  });

  it('адаптеру для мощных карт нужно больше 8-pin', () => {
    expect(adapterPcie8Needed(250)).toBe(2);
    expect(adapterPcie8Needed(360)).toBe(3);
    expect(adapterPcie8Needed(575)).toBe(4);
  });
});

describe('вентиляторы', () => {
  it('ошибка: размер не поддерживается корпусом', () => {
    const build = withPart(
      withPart(completeBuild(), pcCase({ fanSizes: [120] })),
      caseFan({ sizeMm: 140 }),
    );
    expect(expectIssue(build, 'fans.sizeUnsupported', 'error').params).toEqual({ sizeMm: 140 });
  });

  it('подходящий размер — без ошибки', () =>
    expectNo(withPart(completeBuild(), caseFan()), 'fans.sizeUnsupported'));

  it('предупреждение: вентиляторов больше, чем мест (с учётом встроенных и СЖО)', () => {
    let build = withPart(completeBuild(), pcCase({ fanSlots: 6, includedFans: 3 }));
    build = withPart(build, aio({ fans: 3 }));
    build = withPart(build, caseFan({ packCount: 1 }));
    expect(expectIssue(build, 'fans.slotsExceeded', 'warning').params).toEqual({
      count: 7,
      slots: 6,
    });
  });

  it('в пределах мест — без предупреждения', () =>
    expectNo(withPart(completeBuild(), caseFan()), 'fans.slotsExceeded'));

  it('подсказка: вентиляторов больше, чем разъёмов на плате', () => {
    const build = withPart(
      withPart(completeBuild(), motherboard({ fanHeaders: 3 })),
      caseFan({ packCount: 5 }),
    );
    expectIssue(build, 'fans.headersExceeded', 'info');
  });
});

describe('графика и производительность', () => {
  it('предупреждение: CPU без iGPU и без видеокарты', () => {
    let build = withPart(completeBuild(), cpu({ integratedGraphics: false }));
    build = removeFromSlot(build, 'gpu');
    expectIssue(build, 'gpu.noDisplayOutput', 'warning');
    expect(missingSlots(build)).toContain('gpu');
  });

  it('CPU с iGPU работает без видеокарты', () => {
    const build = removeFromSlot(completeBuild(), 'gpu');
    expectNo(build, 'gpu.noDisplayOutput');
    expect(missingSlots(build)).not.toContain('gpu');
    expect(checkBuild(build, perf).status).toBe('ok');
  });

  it('предупреждение: слабый CPU ограничивает топовую видеокарту', () => {
    let build = withPart(completeBuild(), cpu({}, { perfKey: 'cpu-weak' }));
    build = withPart(build, gpu({ chip: 'rtx-5090', tbpW: 575, recommendedPsuW: 1000 }));
    build = withPart(build, psu({ wattage: 1200 }));
    const found = expectIssue(build, 'perf.cpuBottleneck', 'warning');
    expect(Number(found.params?.lossPercent)).toBeGreaterThan(40);
  });

  it('сбалансированная пара — без «горлышка»', () =>
    expectNo(completeBuild(), 'perf.cpuBottleneck'));

  it('без индексов производительности «горлышко» не проверяется', () => {
    let build = withPart(completeBuild(), cpu({}, { perfKey: 'cpu-weak' }));
    build = withPart(build, gpu({ chip: 'rtx-5090' }));
    expect(checkBuild(build).issues.map((i) => i.code)).not.toContain('perf.cpuBottleneck');
  });

  it('подсказка: карта x8 на плате PCIe 4.0', () => {
    let build = withPart(
      completeBuild(),
      gpu({ chip: 'rtx-5060', vramGb: 8, pcieLanes: 8, tbpW: 145 }),
    );
    build = withPart(build, motherboard({ pcieGen: 4 }));
    expectIssue(build, 'perf.pcieBandwidth', 'info');
  });

  it('карта x16 — без подсказки о шине', () => {
    expectNo(withPart(completeBuild(), motherboard({ pcieGen: 3 })), 'perf.pcieBandwidth');
  });

  it('подсказка: 8 ГБ видеопамяти у производительной карты', () => {
    const build = withPart(completeBuild(), gpu({ chip: 'rtx-5060', vramGb: 8 }));
    expectIssue(build, 'perf.vramLimited', 'info');
  });

  it('требуемый индекс CPU растёт с мощностью GPU', () => {
    expect(requiredCpuIndex(1)).toBeCloseTo(0.6);
    expect(requiredCpuIndex(1.85)).toBeGreaterThan(requiredCpuIndex(1));
  });
});

describe('«золотые» сборки', () => {
  it('ITX: длинная карта, ATX-блок и высокий кулер — три ошибки', () => {
    const itxCase = pcCase({
      formFactor: 'sff',
      supportedMotherboards: ['Mini-ITX'],
      maxGpuLengthMm: 336,
      maxGpuSlots: 3,
      maxCoolerHeightMm: 155,
      psuFormFactors: ['SFX', 'SFX-L'],
      expansionSlots: 3,
    });
    let build = withPart(completeBuild(), itxCase);
    build = withPart(
      build,
      motherboard({ formFactor: 'Mini-ITX', memorySlots: 2, maxMemoryGb: 96 }),
    );
    build = withPart(build, gpu({ lengthMm: 357, slotWidth: 3.8 }));
    build = withPart(build, airCooler({ heightMm: 168 }));
    const found = codes(build);
    expect(found).toEqual(
      expect.arrayContaining(['gpu.tooLong', 'gpu.tooThick', 'cooler.tooTall', 'psu.formFactor']),
    );
    expect(checkBuild(build, perf).status).toBe('errors');
  });

  it('AM4 + DDR4: старая платформа собирается без ошибок', () => {
    let build = withPart(
      completeBuild(),
      cpu({
        socket: 'AM4',
        family: 'ryzen-5000',
        memoryTypes: ['DDR4'],
        maxMemoryGb: 128,
        maxMemorySpeedMts: 3200,
        pcieGen: 4,
        integratedGraphics: false,
        includesCooler: true,
      }),
    );
    build = withPart(
      build,
      motherboard({
        socket: 'AM4',
        chipset: 'B550',
        supportedFamilies: ['ryzen-5000'],
        memoryType: 'DDR4',
        maxMemoryGb: 128,
        maxMemorySpeedMts: 4400,
        pcieGen: 4,
      }),
    );
    build = withPart(build, ram({ type: 'DDR4', speedMts: 3600 }));
    expect(checkBuild(build, perf).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('Intel 14-го поколения на плате LGA1851 — ошибка сокета', () => {
    const build = withPart(
      completeBuild(),
      motherboard({ socket: 'LGA1851', chipset: 'Z890', supportedFamilies: ['intel-ultra-200'] }),
    );
    const withCpu = withPart(
      build,
      cpu({ socket: 'LGA1700', family: 'intel-14', memoryTypes: ['DDR4', 'DDR5'] }),
    );
    expect(codes(withCpu)).toContain('cpu.socketMismatch');
  });

  it('RTX 5090 + блок 750 Вт — ошибка мощности', () => {
    let build = withPart(
      completeBuild(),
      gpu({ chip: 'rtx-5090', tbpW: 575, recommendedPsuW: 1000, lengthMm: 357 }),
    );
    build = withPart(build, cpu({ tdpW: 170, maxPowerW: 230 }, { perfKey: 'cpu-top' }));
    build = withPart(build, psu({ wattage: 750 }));
    expect(codes(build)).toContain('psu.insufficient');
  });

  it('полная white-сборка со всеми слотами и вентиляторами — ok', () => {
    let build = withPart(completeBuild(), caseFan({ color: 'white', packCount: 3 }));
    build = withPart(build, hdd());
    expect(['ok', 'warnings']).toContain(checkBuild(build, perf).status);
    expect(checkBuild(build, perf).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('checkCandidate', () => {
  it('помечает несовместимого кандидата причиной', () => {
    const verdict = checkCandidate(
      completeBuild(),
      cpu({ socket: 'LGA1700', family: 'intel-14', memoryTypes: ['DDR5'] }),
      perf,
    );
    expect(verdict.compatible).toBe(false);
    expect(verdict.issues.map((i) => i.code)).toContain('cpu.socketMismatch');
  });

  it('совместимый кандидат без проблем', () => {
    expect(checkCandidate(completeBuild(), gpu({ lengthMm: 320 }), perf)).toEqual({
      compatible: true,
      issues: [],
    });
  });

  it('возвращает только проблемы своего слота', () => {
    let build = withPart(completeBuild(), ram({ capacityGb: 8, modules: 1 }));
    build = withPart(build, psu({ wattage: 450 }));
    const verdict = checkCandidate(build, storage({ capacityGb: 2000 }), perf);
    expect(verdict.issues.every((i) => i.slots.includes('storage'))).toBe(true);
  });

  it('кандидат-видеокарта, которая не влезет в выбранный корпус', () => {
    const build = withPart(completeBuild(), pcCase({ maxGpuLengthMm: 300 }));
    expect(checkCandidate(build, gpu({ lengthMm: 340 }), perf).compatible).toBe(false);
  });

  it('предупреждения не делают кандидата несовместимым', () => {
    const verdict = checkCandidate(completeBuild(), ram({ capacityGb: 16, modules: 1 }), perf);
    expect(verdict.compatible).toBe(true);
    expect(verdict.issues.map((i) => i.code)).toContain('ram.singleChannel');
  });
});
