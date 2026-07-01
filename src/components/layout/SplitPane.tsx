import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

/**
 * Horizontal resizable two-pane split with a draggable divider. Below `md` it
 * stacks vertically (no divider). The user can drag to rebalance left vs right.
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
    <Box ref={wrapRef} sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      <Box sx={{ width: `${pct}%`, minWidth: 0 }}>{left}</Box>
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
      <Box sx={{ width: `calc(${100 - pct}% - 16px)`, minWidth: 0 }}>{right}</Box>
    </Box>
  );
}
