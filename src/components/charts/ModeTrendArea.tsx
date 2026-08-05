import { Area, AreaChart, Brush, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { MonthModeRow } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { formatPeriod, formatTonnes } from '@/utils/format';

const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

/** Stacked-area emissions trend split by transport mode over time. */
export function ModeTrendArea({ data, height = 280 }: { data: MonthModeRow[]; height?: number }) {
  const theme = useTheme();
  const rows = data.map((d) => ({ ...d, periodLabel: formatPeriod(d.period) }));
  // Thin the month labels to ~7 evenly-spaced ticks so they never overlap,
  // regardless of how many months the current filter spans.
  const tickInterval = Math.max(0, Math.floor(rows.length / 7));
  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* Right margin leaves room for the brush's end-date label. */}
      <AreaChart data={rows} margin={{ top: 8, right: 30, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} interval={tickInterval} minTickGap={16} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={54} tickFormatter={(v: number) => formatTonnes(v)} />
        <Tooltip formatter={(v: number, n) => [formatTonnes(v), n as string]} labelFormatter={(l) => `Month: ${l}`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={24} />
        {MODES.map((m) => (
          <Area key={m} type="monotone" dataKey={m} stackId="1" stroke={MODE_COLORS[m]} fill={MODE_COLORS[m]} fillOpacity={0.7} isAnimationActive={false} />
        ))}
        {rows.length > 12 && (
          <Brush
            dataKey="periodLabel"
            height={24}
            travellerWidth={9}
            stroke={theme.palette.primary.main}
            fill={theme.palette.mode === 'dark' ? '#1e293b' : '#f3f4f6'}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
