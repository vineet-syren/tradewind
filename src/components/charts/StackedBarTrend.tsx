import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { chartColor } from '@/app/config/chartColors';
import { formatTonnes } from '@/utils/format';

export interface StackedTrendRow {
  label: string;
  values: Record<string, number>;
}

/** Generic stacked bar trend — one bar per period, stacked by a named series (e.g. CO₂e per carrier per year). */
export function StackedBarTrend({
  rows,
  series,
  height = 280,
  valueFormatter = formatTonnes,
}: {
  rows: StackedTrendRow[];
  series: string[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const theme = useTheme();
  const flat = rows.map((r) => ({ label: r.label, ...r.values }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={flat} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={52} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v: number, name) => [valueFormatter(v), name as string]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((key, i) => (
          <Bar key={key} dataKey={key} stackId="trend" fill={chartColor(i)} maxBarSize={64} isAnimationActive={false} radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
