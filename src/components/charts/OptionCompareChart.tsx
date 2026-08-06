import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import type { RouteOption } from '@/types';
import { OPTION_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

/**
 * CO₂e side by side across a shipment's route options, the booked one first.
 *
 * An air option can be two orders of magnitude above the rest, so the axis is
 * capped at twice the tallest non-outlier bar and any bar beyond it is labelled
 * with its true value and marked off-scale — otherwise every other bar
 * flattens to nothing.
 */
export function OptionCompareChart({
  options,
  height = 240,
  selectedOptionId,
  onSelectOption,
}: {
  options: RouteOption[];
  height?: number;
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
}) {
  const theme = useTheme();
  if (!options.length) return null;

  const sorted = [...options].sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.co2eTonnes - b.co2eTonnes));
  const inScale = sorted.filter((o) => !o.modePath.includes('Air')).map((o) => o.co2eTonnes);
  const cap = inScale.length ? Math.max(...inScale) * 2 : Math.max(...sorted.map((o) => o.co2eTonnes));

  const rows = sorted.map((o) => ({
    id: o.id,
    label: o.label,
    detail: o.detail,
    tagline: o.tagline,
    kind: o.kind,
    value: o.co2eTonnes,
    delta: o.isCurrent ? null : o.co2eDeltaTonnes,
    transit: o.transitDaysEst,
    transitDelta: o.isCurrent ? null : o.transitDeltaDays,
    proven: o.timesUsedInWorkbook,
    display: Math.min(o.co2eTonnes, cap),
    capped: o.co2eTonnes > cap,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 24, right: 16, bottom: 4, left: -4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} interval={0} />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke={theme.palette.text.secondary}
          width={58}
          domain={[0, cap]}
          tickFormatter={(v: number) => formatTonnes(v)}
        />
        {/* The axis labels name the kind of option; the specifics of what each
            one does live here, where they do not have to fit under a bar. */}
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as (typeof rows)[number];
            return (
              <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25, boxShadow: 3, maxWidth: 280 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', color: OPTION_COLORS[row.kind] }}>
                  {row.label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                  {row.detail}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {row.tagline}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontWeight: 700 }}>
                  {formatTonnes(row.value)} CO₂e
                  {row.delta != null && (
                    <Box component="span" sx={{ color: row.delta < 0 ? 'success.main' : 'error.main', ml: 0.5 }}>
                      ({row.delta < 0 ? '−' : '+'}
                      {formatTonnes(Math.abs(row.delta))})
                    </Box>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  ~{row.transit} days transit
                  {row.transitDelta != null && row.transitDelta !== 0
                    ? ` (${row.transitDelta > 0 ? '+' : '−'}${Math.abs(row.transitDelta)})`
                    : ''}
                  {row.delta != null ? ` · used on ${row.proven} shipment${row.proven === 1 ? '' : 's'}` : ''}
                </Typography>
              </Box>
            );
          }}
        />
        <Bar
          dataKey="display"
          radius={[5, 5, 0, 0]}
          barSize={54}
          isAnimationActive={false}
          cursor={onSelectOption ? 'pointer' : undefined}
          onClick={onSelectOption ? (e: { payload?: (typeof rows)[number] }) => e?.payload && onSelectOption(e.payload.id) : undefined}
        >
          {rows.map((r) => (
            <Cell
              key={r.id}
              fill={OPTION_COLORS[r.kind] ?? theme.palette.text.secondary}
              opacity={selectedOptionId && r.id !== selectedOptionId ? 0.45 : 1}
            />
          ))}
          <LabelList
            dataKey="display"
            position="top"
            style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}
            formatter={(_: number, _i?: number) => ''}
          />
          <LabelList
            position="top"
            content={(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
              const row = rows[props.index ?? 0];
              if (!row) return null;
              const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
              const y = Number(props.y ?? 0) - 7;
              return (
                <text x={x} y={y} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}>
                  {formatTonnes(row.value)}
                  {row.capped ? ' ↑' : ''}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
