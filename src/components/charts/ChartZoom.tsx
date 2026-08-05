import { useEffect, useMemo, useState } from 'react';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

export interface ZoomState {
  xDomain: [number, number];
  yDomain: [number, number];
  level: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  canZoomOut: boolean;
}

/* eslint-disable react-refresh/only-export-components -- the hook and its
   control strip are one unit; splitting them across files helps nobody. */
const STEP = 1.6;
const MAX_LEVEL = 8;

/**
 * Zoom for a numeric two-axis chart.
 *
 * Zooming keeps the centre of the data fixed and shrinks the visible span on
 * both axes. On a log scale the span has to be narrowed *multiplicatively* —
 * halving a log axis linearly would collapse it — so the two cases are handled
 * separately rather than fudged with one formula.
 */
export function useZoom(bounds: { x: [number, number]; y: [number, number] }, scale: 'linear' | 'log' = 'linear'): ZoomState {
  const [level, setLevel] = useState(0);

  // A new data set (different filters, different slice) invalidates the old
  // viewport, so drop back to showing everything.
  const key = `${bounds.x[0]}|${bounds.x[1]}|${bounds.y[0]}|${bounds.y[1]}|${scale}`;
  useEffect(() => setLevel(0), [key]);

  return useMemo(() => {
    const factor = STEP ** level;

    const narrow = ([lo, hi]: [number, number]): [number, number] => {
      if (level === 0) return [lo, hi];
      if (scale === 'log') {
        const [a, b] = [Math.log10(Math.max(lo, 1e-9)), Math.log10(Math.max(hi, 1e-9))];
        const mid = (a + b) / 2;
        const half = (b - a) / 2 / factor;
        return [10 ** (mid - half), 10 ** (mid + half)];
      }
      const mid = (lo + hi) / 2;
      const half = (hi - lo) / 2 / factor;
      return [mid - half, mid + half];
    };

    // Pad the full view slightly so edge points are not clipped by the axis.
    const pad = ([lo, hi]: [number, number]): [number, number] => {
      if (scale === 'log') return [lo / 1.35, hi * 1.35];
      const span = hi - lo || Math.abs(hi) || 1;
      return [lo - span * 0.06, hi + span * 0.06];
    };

    return {
      xDomain: narrow(pad(bounds.x)),
      yDomain: narrow(pad(bounds.y)),
      level,
      zoomIn: () => setLevel((l) => Math.min(MAX_LEVEL, l + 1)),
      zoomOut: () => setLevel((l) => Math.max(0, l - 1)),
      reset: () => setLevel(0),
      canZoomOut: level > 0,
    };
  }, [bounds.x, bounds.y, level, scale]);
}

/** The +/−/reset control strip that drives a `useZoom` state. */
export function ChartZoom({ zoom }: { zoom: ZoomState }) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center">
      <Tooltip title="Zoom out">
        <span>
          <IconButton size="small" onClick={zoom.zoomOut} disabled={!zoom.canZoomOut} aria-label="Zoom out">
            <RemoveRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {(1.6 ** zoom.level).toFixed(1)}×
      </Typography>
      <Tooltip title="Zoom in">
        <span>
          <IconButton size="small" onClick={zoom.zoomIn} disabled={zoom.level >= MAX_LEVEL} aria-label="Zoom in">
            <AddRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset zoom">
        <span>
          <IconButton size="small" onClick={zoom.reset} disabled={!zoom.canZoomOut} aria-label="Reset zoom">
            <RestartAltRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
