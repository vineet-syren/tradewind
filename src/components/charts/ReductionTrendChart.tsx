import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { MonthlyPoint } from '@/types';
import { formatPeriod, formatTonnes } from '@/utils/format';

export function ReductionTrendChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useTheme();
  const rows = data.map((d) => ({ ...d, periodLabel: formatPeriod(d.period) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="twNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        {/* Auto-thinned ticks so month labels never overlap; the brush below zooms. */}
        <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={48} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} width={44} />
        <Tooltip
          formatter={(v: number, n) => [formatTonnes(v), n === 'netTonnes' ? 'Net CO₂e' : n === 'grossTonnes' ? 'Gross (pre-action)' : 'Avoided']}
          labelFormatter={(l) => `Month: ${l}`}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Line type="monotone" dataKey="grossTonnes" stroke={theme.palette.text.secondary} strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
        <Area type="monotone" dataKey="netTonnes" stroke={theme.palette.primary.main} strokeWidth={2.5} fill="url(#twNet)" />
        {rows.length > 12 && (
          <Brush dataKey="periodLabel" height={22} travellerWidth={9} stroke={theme.palette.primary.main} fill={theme.palette.mode === 'dark' ? '#1e293b' : '#f3f4f6'} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
