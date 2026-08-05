import { useMemo, useState } from 'react';
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Label } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ChartZoom, useZoom } from './ChartZoom';

export interface BubblePoint {
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  meta?: string;
}

/**
 * Bubble scatter — position by two measures, size by a third.
 *
 * Real lane data is heavily skewed: one lane moves 1,392 t while a dozen move
 * under 10, and intensity runs from 8 g/t·km to 3,200. On a linear scale that
 * piles almost every bubble into the bottom-left corner, which is what this
 * chart used to do. Log is therefore the default: it spreads the cluster out
 * without dropping or rescaling a single value. Linear stays one click away for
 * anyone who wants true proportional spacing, and both axes can be zoomed.
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
  height = 300,
  defaultScale = 'log',
}: {
  points: BubblePoint[];
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  refX?: number;
  refXLabel?: string;
  height?: number;
  defaultScale?: 'linear' | 'log';
}) {
  const theme = useTheme();
  const [scale, setScale] = useState<'linear' | 'log'>(defaultScale);

  // A log axis cannot plot zero or negative values, so the floor is the smallest
  // positive value actually present — nothing is dropped or invented.
  const floors = useMemo(() => {
    const pos = (vals: number[]) => vals.filter((v) => v > 0);
    const xs = pos(points.map((p) => p.x));
    const ys = pos(points.map((p) => p.y));
    return { x: xs.length ? Math.min(...xs) : 1, y: ys.length ? Math.min(...ys) : 1 };
  }, [points]);

  const plotted = useMemo(
    () =>
      scale === 'log'
        ? points.map((p) => ({ ...p, x: Math.max(p.x, floors.x), y: Math.max(p.y, floors.y) }))
        : points,
    [points, scale, floors],
  );

  const bounds = useMemo(
    () => ({
      x: [Math.min(...plotted.map((p) => p.x)), Math.max(...plotted.map((p) => p.x))] as [number, number],
      y: [Math.min(...plotted.map((p) => p.y)), Math.max(...plotted.map((p) => p.y))] as [number, number],
    }),
    [plotted],
  );

  const zoom = useZoom(bounds, scale);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scale}
          onChange={(_, v: 'linear' | 'log' | null) => v && setScale(v)}
          sx={{ '& .MuiToggleButton-root': { px: 1.25, py: 0.25, fontSize: 11, textTransform: 'none' } }}
        >
          <ToggleButton value="log" title="Spread the cluster out — spacing is by order of magnitude">
            Log scale
          </ToggleButton>
          <ToggleButton value="linear" title="True proportional spacing">
            Linear
          </ToggleButton>
        </ToggleButtonGroup>
        <ChartZoom zoom={zoom} />
      </Stack>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 26, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            scale={scale}
            domain={zoom.xDomain}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            stroke={theme.palette.text.secondary}
            tickFormatter={(v: number) => xFormat(v)}
          >
            <Label value={xLabel} position="bottom" offset={8} style={{ fontSize: 11, fill: theme.palette.text.secondary }} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            scale={scale}
            domain={zoom.yDomain}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            stroke={theme.palette.text.secondary}
            width={62}
            tickFormatter={(v: number) => yFormat(v)}
          />
          <ZAxis type="number" dataKey="z" range={[120, 1100]} name={sizeLabel} />
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
          {refX != null && refX > 0 && (
            <ReferenceLine x={refX} stroke={theme.palette.text.secondary} strokeDasharray="5 4">
              <Label value={refXLabel} position="top" style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
            </ReferenceLine>
          )}
          <Scatter data={plotted} fillOpacity={0.78} isAnimationActive={false}>
            {plotted.map((p, i) => (
              <Cell key={i} fill={p.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {scale === 'log' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Log scale — each gridline is ten times the last. Values are unchanged; only the spacing is.
        </Typography>
      )}
    </Box>
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
