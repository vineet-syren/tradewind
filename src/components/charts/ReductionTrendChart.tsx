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

const LABEL: Record<string, string> = {
  co2eTonnes: 'Actual CO₂e',
  ifBestTonnes: 'On the best proven route',
};

/**
 * Monthly CO₂e against what the same month would have cost had every shipment
 * taken the best routing the workbook evidences. The gap between the two lines
 * is the avoidable tonnage.
 *
 * Deliberately *not* a "business as usual" baseline — the workbook holds no
 * counterfactual, so the only honest comparison is against routes it has
 * actually run.
 */
export function ReductionTrendChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useTheme();
  const rows = data.map((d) => ({ ...d, periodLabel: formatPeriod(d.period) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="twActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        {/* Auto-thinned ticks so month labels never overlap; the brush below zooms. */}
        <XAxis
          dataKey="periodLabel"
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
          minTickGap={48}
          stroke={theme.palette.text.secondary}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
          width={52}
          tickFormatter={(v: number) => formatTonnes(v)}
        />
        <Tooltip
          formatter={(v: number, n) => [formatTonnes(v), LABEL[n as string] ?? (n as string)]}
          labelFormatter={(l) => `Month: ${l}`}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="co2eTonnes" stroke={theme.palette.primary.main} strokeWidth={2.5} fill="url(#twActual)" />
        <Line
          type="monotone"
          dataKey="ifBestTonnes"
          stroke={theme.palette.success.main}
          strokeDasharray="5 4"
          dot={false}
          strokeWidth={1.8}
        />
        {rows.length > 12 && (
          <Brush
            dataKey="periodLabel"
            height={22}
            travellerWidth={9}
            stroke={theme.palette.primary.main}
            fill={theme.palette.mode === 'dark' ? '#1e293b' : '#f3f4f6'}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
