import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Box, Stack, Typography } from '@mui/material';
import { chartColor } from '@/app/config/chartColors';
import { formatTonnes } from '@/utils/format';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

/** Generic donut with side legend and an optional centre total overlay. */
export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
  valueFormatter = formatTonnes,
}: {
  data: DonutSlice[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fill = (i: number) => data[i].color ?? chartColor(i);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={2}>
      <Box sx={{ position: 'relative', width: height, height, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={fill(i)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n) => [valueFormatter(v), n as string]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              {centerValue && (
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                  {centerValue}
                </Typography>
              )}
              {centerLabel && (
                <Typography variant="caption" color="text.secondary">
                  {centerLabel}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>
      <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 130 }}>
        {data.map((d, i) => (
          <Stack key={d.label} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: fill(i), flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {d.label}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {total > 0 ? Math.round((d.value / total) * 100) : 0}% · {valueFormatter(d.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
