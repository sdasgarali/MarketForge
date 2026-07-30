'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Series {
  key: string;
  label: string;
  color: string;
}

export function AreaTrend({
  data,
  series,
  xKey = 'date',
  height = 240,
  formatX,
}: {
  data: Record<string, unknown>[];
  series: Series[];
  xKey?: string;
  height?: number;
  formatX?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={`grad-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatX}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
            color: 'hsl(var(--popover-foreground))',
          }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
