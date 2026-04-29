'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface StockPriceChartProps {
  data: { date: string; close: number; volume: number | null }[];
  filingDates?: string[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatPrice(val: number): string {
  return `$${val.toFixed(2)}`;
}

interface TooltipPayloadEntry {
  value: number;
  payload: { date: string; close: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="text-neutral-500">
        {new Date(entry.payload.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="font-semibold text-neutral-900 mt-0.5">{formatPrice(entry.value)}</p>
    </div>
  );
}

export function StockPriceChart({ data, filingDates }: StockPriceChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No stock price data available
      </div>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={sorted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: '#a3a3a3' }}
          axisLine={{ stroke: '#e5e5e5' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `$${v}`}
          tick={{ fontSize: 11, fill: '#a3a3a3' }}
          axisLine={false}
          tickLine={false}
          width={60}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#stockGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
        />
        {filingDates?.map((d) => (
          <ReferenceLine
            key={d}
            x={d}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
