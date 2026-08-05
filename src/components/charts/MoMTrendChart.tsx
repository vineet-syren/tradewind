import { Bar, Brush, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';
import { formatTonnes } from '@/utils/format';
import { ORIGIN_COLOR } from '@/constants/app';
import type { DataOrigin } from '@/types';

export interface MonthValueRow {
  label: string;
  value: number;
  /** Recorded month or one of the mirrored ones — shades the bar. */
  dataOrigin?: DataOrigin;
}

/** Round up to a tidy axis bound so ticks land on readable numbers. */
function niceBound(v: number): number {
  if (v <= 25) return 25;
  if (v <= 50) return 50;
  if (v <= 100) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

/**
 * Month-over-month trend — monthly CO₂e bars with a % change line against the
 * previous month. A brush below the chart zooms into any stretch of timeline.
 *
 * The % line is the part that has to be handled carefully. A near-empty month
 * produces a swing of several thousand percent, which flattens every other
 * point to a straight line. Clamping the *axis* is not enough: Recharts then
 * draws the out-of-range segments as near-vertical strokes shooting off the
 * plot, which is what made this chart unreadable. So the *values* are clamped
 * instead, and a clamped point is drawn hollow with an arrow — the true figure
 * stays in the tooltip. Same treatment as the off-scale bars in
 * `OptionCompareChart`, for the same reason.
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

  const withSwing = data.map((d, i) => {
    const prev = i > 0 ? data[i - 1].value : null;
    return { ...d, truePct: prev && prev > 0 ? ((d.value - prev) / prev) * 100 : null };
  });

  const swings = withSwing.map((r) => r.truePct).filter((v): v is number => v != null);
  // 90th percentile of the absolute swings, so a single freak month cannot set
  // the scale for the other thirty.
  const pctBound = (() => {
    if (!swings.length) return 100;
    const sorted = swings.map(Math.abs).sort((a, b) => a - b);
    return niceBound(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]);
  })();

  const rows = withSwing.map((r) => ({
    ...r,
    momPct: r.truePct == null ? null : Math.max(-pctBound, Math.min(pctBound, r.truePct)),
    clamped: r.truePct != null && Math.abs(r.truePct) > pctBound,
  }));

  const anyClamped = rows.some((r) => r.clamped);
  const anySynthetic = rows.some((r) => r.dataOrigin === 'synthetic');
  const barFill = theme.palette.mode === 'dark' ? '#334155' : '#111827';

  return (
    <Box>
      <ResponsiveContainer width="100%" height={height}>
        {/* Margins leave room for the brush's own start/end date labels, which
            Recharts draws outside the plot area and would otherwise be clipped. */}
        <ComposedChart data={rows} margin={{ top: 10, right: 30, bottom: 0, left: 6 }}>
          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10.5 }} stroke={theme.palette.text.secondary} interval="preserveStartEnd" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            stroke={theme.palette.text.secondary}
            width={56}
            tickFormatter={(v: number) => valueFormatter(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke={theme.palette.primary.main}
            width={52}
            domain={[-pctBound, pctBound]}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
          />
          <ReferenceLine yAxisId="right" y={0} stroke={theme.palette.divider} />
          <Tooltip
            contentStyle={{ borderRadius: 10, fontSize: 12 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof rows)[number];
              return (
                <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, boxShadow: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    {label}
                    {row.dataOrigin === 'synthetic' ? ' · synthetic' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    CO₂e: {valueFormatter(row.value)}
                  </Typography>
                  {row.truePct != null && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {row.truePct > 0 ? '+' : ''}
                      {row.truePct.toFixed(1)}% vs previous month
                      {row.clamped ? ' (beyond the axis — plotted at the edge)' : ''}
                    </Typography>
                  )}
                </Box>
              );
            }}
          />
          <Bar yAxisId="left" dataKey="value" name="CO₂e" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.dataOrigin === 'synthetic' ? ORIGIN_COLOR.synthetic : barFill} fillOpacity={r.dataOrigin === 'synthetic' ? 0.55 : 1} />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            dataKey="momPct"
            name="MoM change"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const row = rows[props.index ?? 0];
              const key = `dot-${props.index}`;
              if (!row || row.momPct == null) return <g key={key} />;
              // Hollow marker = the true swing is past the edge of the axis.
              return row.clamped ? (
                <circle key={key} cx={props.cx} cy={props.cy} r={4} fill={theme.palette.background.paper} stroke={theme.palette.primary.main} strokeWidth={2} />
              ) : (
                <circle key={key} cx={props.cx} cy={props.cy} r={2.5} fill={theme.palette.primary.main} />
              );
            }}
          />
          {zoomable && rows.length > 6 && (
            <Brush
              dataKey="label"
              height={24}
              travellerWidth={9}
              stroke={theme.palette.primary.main}
              fill={theme.palette.mode === 'dark' ? '#1e293b' : '#f3f4f6'}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        <Legend swatch={barFill} label="CO₂e recorded in the workbook" />
        {anySynthetic && <Legend swatch={ORIGIN_COLOR.synthetic} label="CO₂e on synthetic months" faded />}
        <Legend swatch={theme.palette.primary.main} label="Change vs the previous month (right axis)" />
        {anyClamped && (
          <Typography variant="caption" color="text.secondary">
            ○ swing larger than ±{pctBound}% — plotted at the edge, true value in the tooltip
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function Legend({ swatch, label, faded = false }: { swatch: string; label: string; faded?: boolean }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: swatch, opacity: faded ? 0.55 : 1 }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
