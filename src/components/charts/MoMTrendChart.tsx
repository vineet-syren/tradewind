import { Bar, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { formatTonnes } from '@/utils/format';

export interface MonthValueRow {
  label: string;
  value: number;
}

/**
 * Month-over-month trend — monthly CO₂e bars with a % change line vs the
 * previous month. A brush below the chart lets the user zoom into any stretch
 * of the timeline and zoom back out (drag the handles or slide the window).
 */
export function MoMTrendChart({
  data,
  height = 260,
  valueFormatter = formatTonnes,
  zoomable = true,
}: {
  data: MonthValueRow[];
  height?: number;
  valueFormatter?: (v: number) => string;
  zoomable?: boolean;
}) {
  const theme = useTheme();
  const rows = data.map((d, i) => {
    const prev = i > 0 ? data[i - 1].value : null;
    const momPct = prev && prev > 0 ? ((d.value - prev) / prev) * 100 : null;
    return { ...d, momPct };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10.5 }} stroke={theme.palette.text.secondary} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={52} tickFormatter={(v: number) => valueFormatter(v)} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke={theme.palette.primary.main} width={44} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`} />
        <Tooltip
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
          formatter={(v: number, name: string) =>
            name === 'MoM change' ? [`${v > 0 ? '+' : ''}${v.toFixed(1)}% vs previous month`, name] : [valueFormatter(v), 'CO₂e']
          }
        />
        <Bar yAxisId="left" dataKey="value" name="CO₂e" fill={theme.palette.mode === 'dark' ? '#334155' : '#111827'} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Line yAxisId="right" dataKey="momPct" name="MoM change" stroke={theme.palette.primary.main} strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
        {zoomable && rows.length > 6 && (
          <Brush dataKey="label" height={22} travellerWidth={9} stroke={theme.palette.primary.main} fill={theme.palette.mode === 'dark' ? '#1e293b' : '#f3f4f6'} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
