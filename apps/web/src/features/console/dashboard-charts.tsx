'use client';

import { formatNumber, formatPrice } from '@redcore/i18n';
import { useLocale } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Цвета графиков — токены бренда: красный для выручки, нейтральный металл для количества
const RED = '#FF2800';
const STEEL = '#A1A1AA';
const GRID = '#2A2A31';

const axis = { stroke: STEEL, fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltip = {
  contentStyle: {
    background: '#16161A',
    border: '1px solid #2A2A31',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#F5F5F7' },
} as const;

export function RevenueChart({
  data,
  label,
}: {
  data: { day: string; revenueUzs: number }[];
  label: string;
}) {
  const locale = useLocale();
  const short = (v: number) =>
    v >= 1e6 ? `${formatNumber(Math.round(v / 1e5) / 10, locale)}M` : formatNumber(v, locale);
  return (
    <div className="h-64" role="img" aria-label={label} data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="day"
            {...axis}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis {...axis} tickFormatter={short} width={48} />
          <Tooltip {...tooltip} formatter={(v) => [formatPrice(Number(v), locale), label]} />
          <Line type="monotone" dataKey="revenueUzs" stroke={RED} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({
  data,
  label,
}: {
  data: { day: string; orders: number }[];
  label: string;
}) {
  return (
    <div className="h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="day"
            {...axis}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis {...axis} allowDecimals={false} width={32} />
          <Tooltip {...tooltip} formatter={(v) => [String(v), label]} />
          <Bar dataKey="orders" fill={STEEL} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
