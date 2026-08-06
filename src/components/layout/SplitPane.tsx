import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

/**
 * Horizontal resizable two-pane split with a draggable divider. Below `md` it
 * stacks vertically (no divider). The user can drag to rebalance left vs right.
 *
 * Both panes end level, and CSS alone decides where. The row stretches its
 * children, so each pane is as tall as the taller one's content; a pane that
 * wants to fill that height gives its scrollable child `flex-grow: 1` with a
 * zero basis and a `min-height` floor.
 *
 * This replaced a version that measured the right pane in JS and fed its height
 * back as the left pane's. Two things went wrong with that. The measurement ran
 * on render, but the right pane loads its detail asynchronously — so it latched
 * onto the empty-state height and only corrected on the *next* selection, leaving
 * the left column short beside a tall panel. A ResizeObserver was meant to cover
 * that, and does in Chrome, but it is unavailable in some embedded browsers and
 * there the pane never recovered at all. Letting the layout engine resolve it
 * removes the race, the observer, and the fallbacks together.
 */
export function SplitPane({
  left,
  right,
  initial = 50,
  min = 28,
  max = 72,
}: {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
  max?: number;
}) {
  const theme = useTheme();
  const stack = useMediaQuery(theme.breakpoints.down('md'));
  const [pct, setPct] = useState(initial);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const p = ((e.clientX - r.left) / r.width) * 100;
      setPct(Math.min(max, Math.max(min, p)));
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [min, max]);

  if (stack) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ minWidth: 0 }}>{left}</Box>
        <Box sx={{ minWidth: 0 }}>{right}</Box>
      </Box>
    );
  }

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    // `stretch`, so both panes take the height of the taller one's content.
    <Box ref={wrapRef} sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      <Box sx={{ width: `${pct}%`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{left}</Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        onDoubleClick={() => setPct(50)}
        title="Drag to resize · double-click to reset"
        sx={{
          width: 16,
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover .tw-grip': { bgcolor: 'primary.main', height: 64 },
        }}
      >
        <Box className="tw-grip" sx={{ width: 4, height: 44, borderRadius: 2, bgcolor: 'divider', transition: 'height .15s, background-color .15s' }} />
      </Box>
      <Box sx={{ width: `calc(${100 - pct}% - 16px)`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {right}
      </Box>
    </Box>
  );
}
