import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatTonnes } from '@/utils/format';

export interface WaterfallStep {
  label: string;
  value: number;
  kind?: 'start' | 'delta' | 'end';
}

const TOTAL_COLOR = '#6366f1';
const UP_COLOR = '#f43f5e';
const DOWN_COLOR = '#10b981';

/** Waterfall/bridge chart — absolute start/end totals with floating signed deltas between. */
export function WaterfallChart({
  data,
  height = 300,
  valueFormatter = formatTonnes,
}: {
  data: WaterfallStep[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const theme = useTheme();

  let running = 0;
  const rows = data.map((step) => {
    const kind = step.kind ?? 'delta';
    if (kind === 'start' || kind === 'end') {
      running = step.value;
      return {
        label: step.label,
        kind,
        value: step.value,
        base: 0,
        bar: Math.max(step.value, 0),
        running,
        labelText: valueFormatter(step.value),
      };
    }
    const from = running;
    running += step.value;
    return {
      label: step.label,
      kind,
      value: step.value,
      base: Math.min(from, running),
      bar: Math.abs(step.value),
      running,
      labelText: `${step.value > 0 ? '+' : '−'}${valueFormatter(Math.abs(step.value))}`,
    };
  });

  const color = (r: (typeof rows)[number]) =>
    r.kind !== 'delta' ? TOTAL_COLOR : r.value > 0 ? UP_COLOR : DOWN_COLOR;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 24, right: 12, bottom: 4, left: -4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10.5 }} stroke={theme.palette.text.secondary} interval={0} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={54} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as (typeof rows)[number];
            return (
              <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, boxShadow: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>{r.label}</Typography>
                <Typography variant="caption" sx={{ color: color(r), fontWeight: 600 }}>
                  {r.kind === 'delta' ? `${r.value > 0 ? '+' : '−'}${valueFormatter(Math.abs(r.value))}` : valueFormatter(r.value)}
                </Typography>
                {r.kind === 'delta' && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    Running total: {valueFormatter(r.running)}
                  </Typography>
                )}
              </Box>
            );
          }}
        />
        {/* Invisible base lifts each floating delta to its running position. */}
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="bar" stackId="wf" isAnimationActive={false} radius={[4, 4, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.label} fill={color(r)} />
          ))}
          <LabelList
            dataKey="labelText"
            position="top"
            style={{ fontSize: 10.5, fontWeight: 700, fill: theme.palette.text.primary }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
