import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { ScheduleWeek } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

/** Projected CO₂e by week across the planning window, stacked by transport mode. */
export function ScheduleBars({ data, height = 280 }: { data: ScheduleWeek[]; height?: number }) {
  const theme = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -6 }} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} interval={0} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={46} allowDecimals={false} tickFormatter={(v: number) => formatTonnes(v)} />
        <Tooltip
          formatter={(v: number, n) => [formatTonnes(v), n as string]}
          labelFormatter={(l) => `Week of ${l}`}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {MODES.map((m, i) => (
          <Bar key={m} dataKey={m} stackId="1" fill={MODE_COLORS[m]} radius={i === MODES.length - 1 ? [3, 3, 0, 0] : undefined} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
