import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

/**
 * Horizontal resizable two-pane split with a draggable divider. Below `md` it
 * stacks vertically (no divider). The user can drag to rebalance left vs right.
 *
 * The left pane is given a definite height that tracks the right one, so a long
 * left-hand list scrolls inside the split instead of leaving dead space beside a
 * taller right pane. Flex `stretch` cannot do this: the row's height is the
 * taller of the two panes' *content*, and an unbounded list is always taller. So
 * the right pane is measured and the left is sized from it — never the reverse,
 * which keeps the two from chasing each other.
 */
export function SplitPane({
  left,
  right,
  initial = 50,
  min = 28,
  max = 72,
  minLeftHeight = 520,
}: {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
  max?: number;
  /** Floor for the left pane, so a short right pane cannot squash the list. */
  minLeftHeight?: number;
}) {
  const theme = useTheme();
  const stack = useMediaQuery(theme.breakpoints.down('md'));
  const [pct, setPct] = useState(initial);
  const [rightHeight, setRightHeight] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const measureRight = () => {
    const el = rightRef.current;
    if (stack || !el) return;
    const h = el.getBoundingClientRect().height;
    // Bail out inside the setter when nothing moved, so this stays safe to call
    // from an every-render layout effect.
    setRightHeight((prev) => (prev !== null && Math.abs(prev - h) < 1 ? prev : h));
  };

  // Two triggers, because they catch different things. The layout effect runs on
  // every render, so switching selection resizes in the same frame. The observer
  // catches every height change that never re-renders this component — and that
  // is the common one, since the right pane fetches its own detail and settles a
  // turn or two after the click.
  useLayoutEffect(measureRight);

  useEffect(() => {
    const el = rightRef.current;
    if (stack || !el) {
      setRightHeight(null);
      return;
    }
    const ro = new ResizeObserver(measureRight);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack]);

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
    <Box ref={wrapRef} sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      <Box
        sx={{
          width: `${pct}%`,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: rightHeight ? Math.max(rightHeight, minLeftHeight) : undefined,
        }}
      >
        {left}
      </Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        onDoubleClick={() => setPct(50)}
        title="Drag to resize · double-click to reset"
        sx={{
          width: 16,
          flexShrink: 0,
          alignSelf: 'stretch',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover .tw-grip': { bgcolor: 'primary.main', height: 64 },
        }}
      >
        <Box className="tw-grip" sx={{ width: 4, height: 44, borderRadius: 2, bgcolor: 'divider', transition: 'height .15s, background-color .15s' }} />
      </Box>
      {/* Height stays content-driven here — it is what the left pane is sized
          from, so stretching it would make the two chase each other. */}
      <Box ref={rightRef} sx={{ width: `calc(${100 - pct}% - 16px)`, minWidth: 0 }}>
        {right}
      </Box>
    </Box>
  );
}
