import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Box, Stack, Typography } from '@mui/material';
import type { ModeSplitRow } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

export function ModeSplitDonut({ data, height = 220 }: { data: ModeSplitRow[]; height?: number }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={2}>
      <Box sx={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="co2eTonnes" nameKey="mode" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.mode} fill={MODE_COLORS[d.mode] ?? '#999'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, n) => [formatTonnes(v), n as string]}
              contentStyle={{ borderRadius: 10, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 130 }}>
        {data.map((d) => (
          <Stack key={d.mode} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: MODE_COLORS[d.mode] }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {d.mode}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {d.pct}% · {formatTonnes(d.co2eTonnes)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
