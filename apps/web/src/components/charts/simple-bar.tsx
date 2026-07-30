'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function SimpleBar({
  data,
  xKey,
  bars,
  height = 260,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
            color: 'hsl(var(--popover-foreground))',
          }}
        />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
