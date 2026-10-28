import type { BuildStatus, CompatIssue, PcComponentType, PowerReport } from '@redcore/domain';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  InfoIcon,
  XOctagonIcon,
  ZapIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type CompatKey = Parameters<ReturnType<typeof useTranslations<'compat'>>>[0];

/** Текст проблемы на языке страницы: compat.<code> с ICU-параметрами из движка. */
export function useIssueText() {
  const t = useTranslations('compat');
  return (issue: CompatIssue) => t(issue.code as CompatKey, issue.params ?? {});
}

const severityStyle = {
  error: { icon: XOctagonIcon, className: 'border-danger/40 bg-danger/8 text-danger' },
  warning: { icon: AlertTriangleIcon, className: 'border-warning/35 bg-warning/6 text-warning' },
  info: { icon: InfoIcon, className: 'border-info/30 bg-info/6 text-info' },
} as const;

const statusStyle: Record<BuildStatus, { icon: typeof InfoIcon; className: string }> = {
  ok: { icon: CheckCircle2Icon, className: 'text-success' },
  warnings: { icon: AlertTriangleIcon, className: 'text-warning' },
  errors: { icon: XOctagonIcon, className: 'text-danger' },
  incomplete: { icon: CircleDashedIcon, className: 'text-steel-300' },
};

export function BuildStatusLabel({
  status,
  className,
}: {
  status: BuildStatus;
  className?: string;
}) {
  const t = useTranslations('compat.status');
  const { icon: Icon, className: tone } = statusStyle[status];
  return (
    <span
      data-testid="build-status"
      data-status={status}
      className={cn('inline-flex items-center gap-2 font-semibold', tone, className)}
    >
      <Icon className="size-4 shrink-0" />
      {t(status)}
    </span>
  );
}

export function IssueList({
  issues,
  onSlotClick,
}: {
  issues: CompatIssue[];
  onSlotClick?: (slot: PcComponentType) => void;
}) {
  const text = useIssueText();
  const ts = useTranslations('compat.severity');
  const tSlots = useTranslations('configurator.slots');
  const ta = useTranslations('configurator.actions');
  return (
    <ul className="space-y-2" data-testid="compat-issues">
      {issues.map((issue, index) => {
        const { icon: Icon, className } = severityStyle[issue.severity];
        return (
          <li
            key={`${issue.code}-${index}`}
            data-code={issue.code}
            data-severity={issue.severity}
            className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm', className)}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-foreground">
                <span className="sr-only">{`${ts(issue.severity)}: `}</span>
                {text(issue)}
              </p>
              {onSlotClick && issue.slots.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {issue.slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onSlotClick(slot)}
                      aria-label={ta('goToSlot', { slot: tSlots(slot) })}
                      className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-steel-300 transition-colors hover:border-brand-bright/50 hover:text-foreground"
                    >
                      {tSlots(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Шкала мощности: нагрузка сборки относительно выбранного (или рекомендуемого) блока питания. */
export function PowerMeter({ power }: { power: PowerReport }) {
  const t = useTranslations('configurator.power');
  const percent = power.loadPercent;
  const overloaded = percent !== undefined && percent > 100;
  const tone =
    percent === undefined
      ? 'text-steel-300'
      : percent > 90
        ? 'text-danger'
        : percent > 75
          ? 'text-warning'
          : 'text-success';

  return (
    <div className="space-y-2" data-testid="power-meter">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <ZapIcon className="size-4 text-brand-bright" aria-hidden="true" />
          {t('title')}
        </span>
        <span className="font-mono text-xs text-steel-300 tabular-nums">
          {t('load', { watts: power.loadW })}
        </span>
      </div>
      <Progress
        value={Math.min(percent ?? (power.loadW / power.recommendedPsuW) * 100, 100)}
        aria-label={t('title')}
        className={cn(overloaded && '[&>[data-slot=progress-indicator]]:bg-danger')}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-steel-300">{t('recommended', { watts: power.recommendedPsuW })}</span>
        <span className={cn('font-medium tabular-nums', tone)} data-testid="psu-load">
          {percent === undefined ? t('noPsu') : t('psuLoad', { percent })}
        </span>
      </div>
    </div>
  );
}
