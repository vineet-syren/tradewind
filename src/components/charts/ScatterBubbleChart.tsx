import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Label } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';

export interface BubblePoint {
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  meta?: string;
}

/**
 * Bubble scatter — position by two measures, size by a third. Used for carrier
 * benchmarking (intensity vs volume) and lane priority (volume vs intensity),
 * with an optional reference line (e.g. fleet-average intensity).
 */
export function ScatterBubbleChart({
  points,
  xLabel,
  yLabel,
  sizeLabel,
  xFormat = (v) => `${v}`,
  yFormat = (v) => `${v}`,
  refX,
  refXLabel,
  xDomain = ['auto', 'auto'],
  yDomain = ['auto', 'auto'],
  height = 300,
}: {
  points: BubblePoint[];
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  refX?: number;
  refXLabel?: string;
  xDomain?: [number | 'auto', number | 'auto'];
  yDomain?: [number | 'auto', number | 'auto'];
  height?: number;
}) {
  const theme = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, bottom: 24, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis type="number" dataKey="x" name={xLabel} domain={xDomain} tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} tickFormatter={(v: number) => xFormat(v)}>
          <Label value={xLabel} position="bottom" offset={8} style={{ fontSize: 11, fill: theme.palette.text.secondary }} />
        </XAxis>
        <YAxis type="number" dataKey="y" name={yLabel} domain={yDomain} allowDecimals={false} tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={52} tickFormatter={(v: number) => yFormat(v)} />
        <ZAxis type="number" dataKey="z" range={[140, 1500]} name={sizeLabel} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as BubblePoint;
            return (
              <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, boxShadow: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{xLabel}: {xFormat(p.x)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{yLabel}: {yFormat(p.y)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sizeLabel}: {p.z}</Typography>
                {p.meta && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{p.meta}</Typography>}
              </Box>
            );
          }}
        />
        {refX != null && (
          <ReferenceLine x={refX} stroke={theme.palette.text.secondary} strokeDasharray="5 4">
            <Label value={refXLabel} position="top" style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
          </ReferenceLine>
        )}
        <Scatter data={points} fillOpacity={0.78} isAnimationActive={false}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.color} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** A compact swatch legend row. */
export function SwatchLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} sx={{ mt: 1 }}>
      {items.map((it) => (
        <Stack key={it.label} direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: it.color }} />
          <Typography variant="caption" color="text.secondary">{it.label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}
