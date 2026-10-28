import { describe, expect, it } from 'vitest';
import { analyzeBuild } from './analyze';
import {
  completeBuild,
  cpu,
  gpu,
  hdd,
  motherboard,
  perf,
  psu,
  ram,
  storage,
  withPart,
} from './test/fixtures';

const codes = (b: ReturnType<typeof completeBuild>, options?: Parameters<typeof analyzeBuild>[2]) =>
  analyzeBuild(b, perf, options).map((f) => f.code);

describe('анализ баланса сборки', () => {
  it('сбалансированная эталонная сборка — без замечаний о «горлышке»', () => {
    const findings = codes(completeBuild());
    expect(findings).not.toContain('cpu_bottleneck');
    expect(findings).not.toContain('ram_single_channel');
  });

  it('слабый процессор к топовой видеокарте — упор в CPU и совет усилить процессор', () => {
    const build = withPart(
      withPart(completeBuild(), cpu({}, { perfKey: 'cpu-weak' })),
      gpu({ chip: 'rtx-5090', vramGb: 32, tbpW: 575, recommendedPsuW: 1000 }),
    );
    const finding = analyzeBuild(build, perf).find((f) => f.code === 'cpu_bottleneck')!;
    expect(finding.fix).toEqual({ slot: 'cpu', direction: 'faster' });
    expect(finding.params.lossPercent).toBeGreaterThan(0);
  });

  it('мощный процессор при слабой карте — видеокарта отстаёт', () => {
    const build = withPart(
      withPart(completeBuild(), cpu({ tdpW: 120, maxPowerW: 162 }, { perfKey: 'cpu-top' })),
      gpu({ chip: 'rtx-5060', vramGb: 8, tbpW: 145, recommendedPsuW: 550 }),
    );
    expect(codes(build, { resolution: '2160p' })).toEqual(
      expect.arrayContaining(['gpu_weak_for_cpu', 'vram_low_for_resolution']),
    );
    expect(codes(build, { resolution: '1080p' })).not.toContain('vram_low_for_resolution');
  });

  it('блок питания: впритык и с огромным запасом', () => {
    const top = withPart(
      completeBuild(),
      gpu({ chip: 'rtx-5090', vramGb: 32, tbpW: 575, recommendedPsuW: 1000 }),
    );
    expect(codes(withPart(top, psu({ wattage: 850 })))).toContain('psu_tight');
    expect(codes(withPart(completeBuild(), psu({ wattage: 1600 })))).toContain('psu_oversized');
  });

  it('память и накопители: одноканал, мало памяти, только HDD, маленький SSD', () => {
    const single = withPart(completeBuild(), ram({ modules: 1, capacityGb: 16 }));
    expect(codes(single)).toEqual(
      expect.arrayContaining(['ram_single_channel', 'ram_low_for_tier']),
    );
    const hddOnly = { ...completeBuild(), storage: [{ product: hdd(), qty: 1 }] };
    expect(codes(hddOnly)).toContain('hdd_only');
    const small = {
      ...completeBuild(),
      storage: [{ product: storage({ capacityGb: 500 }), qty: 1 }],
    };
    expect(codes(small)).toContain('storage_small');
    expect(codes(small, { purpose: 'workstation' })).not.toContain('storage_small');
  });

  it('бюджет: дорогая плата при дешёвой карте и малая доля видеокарты', () => {
    const build = withPart(
      withPart(completeBuild(), motherboard({}, { priceUzs: 9_000_000 })),
      gpu(
        { chip: 'rtx-5060', vramGb: 8, tbpW: 145, recommendedPsuW: 550 },
        { priceUzs: 3_000_000 },
      ),
    );
    expect(codes(build)).toEqual(
      expect.arrayContaining(['motherboard_overspend', 'gpu_budget_share_low']),
    );
  });
});
