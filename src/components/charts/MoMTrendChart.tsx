import { Bar, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { formatTonnes } from '@/utils/format';

export interface MonthValueRow {
  label: string;
  value: number;
}

/** Round up to a tidy axis bound so ticks land on readable numbers. */
function niceBound(v: number): number {
  if (v <= 100) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

/**
 * Month-over-month trend — monthly CO₂e bars with a % change line against the
 * previous month. A brush below the chart zooms into any stretch of timeline.
 *
 * The % axis is clamped to the middle 90% of the swings. A near-empty month
 * (this book has one at 0.38 t) otherwise produces a +7,000% spike that
 * flattens every bar; the clipped point keeps its true value in the tooltip.
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

  const swings = rows.map((r) => r.momPct).filter((v): v is number => v != null);
  const pctBound = (() => {
    if (!swings.length) return 100;
    const sorted = [...swings].map(Math.abs).sort((a, b) => a - b);
    // 90th percentile, so one outlier cannot set the scale.
    const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
    return niceBound(p90);
  })();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10.5 }} stroke={theme.palette.text.secondary} interval="preserveStartEnd" />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          stroke={theme.palette.text.secondary}
          width={52}
          tickFormatter={(v: number) => valueFormatter(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          stroke={theme.palette.primary.main}
          width={48}
          domain={[-pctBound, pctBound]}
          allowDataOverflow
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
          formatter={(v: number, name: string) =>
            name === 'MoM change' ? [`${v > 0 ? '+' : ''}${v.toFixed(1)}% vs previous month`, name] : [valueFormatter(v), 'CO₂e']
          }
        />
        <Bar
          yAxisId="left"
          dataKey="value"
          name="CO₂e"
          fill={theme.palette.mode === 'dark' ? '#334155' : '#111827'}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          dataKey="momPct"
          name="MoM change"
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          dot={{ r: 2.5 }}
          connectNulls
          isAnimationActive={false}
        />
        {zoomable && rows.length > 6 && (
          <Brush
            dataKey="label"
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
