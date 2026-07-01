import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ScopeSummary } from '@/types';
import { SCOPE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

/** Donut of the org footprint split by GHG Protocol scope, with a centred total. */
export function ScopeDonutChart({ data, total, height = 240 }: { data: ScopeSummary[]; total: number; height?: number }) {
  const theme = useTheme();
  return (
    <Box sx={{ position: 'relative', width: '100%', height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip
            formatter={(v: number, _n, p) => [`${formatTonnes(v)} · ${(p.payload as ScopeSummary).pct}%`, (p.payload as ScopeSummary).label]}
            contentStyle={{ borderRadius: 10, fontSize: 12 }}
          />
          <Pie
            data={data}
            dataKey="co2eTonnes"
            nameKey="label"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke={theme.palette.background.paper}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((s) => (
              <Cell key={s.scope} fill={SCOPE_COLORS[s.scope]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={0}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {formatTonnes(total)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          total CO₂e / yr
        </Typography>
      </Stack>
    </Box>
  );
}
