import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatDate } from '@/utils/format';

export interface GanttItem {
  id: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  color?: string;
  meta?: string;
}

const DAY_MS = 86_400_000;
const toMs = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

/** Date-scaled timeline — one bar per item from start to end, with week ticks and a "today" marker. */
export function GanttChart({
  items,
  height,
  todayIso,
}: {
  items: GanttItem[];
  height?: number;
  todayIso?: string;
}) {
  const theme = useTheme();
  if (!items.length) return null;

  const min = Math.min(...items.map((i) => toMs(i.start))) - 2 * DAY_MS;
  const max = Math.max(...items.map((i) => toMs(i.end))) + 2 * DAY_MS;
  const span = Math.max(max - min, DAY_MS);
  const pos = (ms: number) => ((ms - min) / span) * 100;

  // Weekly ticks across the domain (cap ~10 so labels stay readable).
  const tickStep = Math.max(Math.ceil(span / DAY_MS / 7 / 10), 1) * 7 * DAY_MS;
  const ticks: number[] = [];
  for (let t = min + 2 * DAY_MS; t <= max; t += tickStep) ticks.push(t);

  const todayMs = todayIso ? toMs(todayIso) : null;
  const showToday = todayMs != null && todayMs >= min && todayMs <= max;
  const LABEL_W = 180;

  return (
    <Box
      role="img"
      aria-label={`Timeline of ${items.length} departures from ${formatDate(items[0].start)}; each bar spans ship date to arrival`}
      sx={{ maxHeight: height, overflowY: height ? 'auto' : undefined }}
    >
      {/* Tick header */}
      <Stack direction="row" sx={{ mb: 0.5 }}>
        <Box sx={{ width: LABEL_W, flexShrink: 0 }} />
        <Box sx={{ position: 'relative', flexGrow: 1, height: 18 }}>
          {ticks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              sx={{ position: 'absolute', left: `${pos(t)}%`, transform: 'translateX(-50%)', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              {new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </Typography>
          ))}
        </Box>
      </Stack>

      <Stack spacing={0.75}>
        {items.map((item) => {
          const s = toMs(item.start);
          const e = Math.max(toMs(item.end), s + DAY_MS / 2);
          const days = Math.round((e - s) / DAY_MS);
          const color = item.color ?? theme.palette.primary.main;
          const left = pos(s);
          const width = Math.max(pos(e) - left, 1.2);
          return (
            <Stack key={item.id} direction="row" alignItems="center">
              <Typography variant="caption" sx={{ width: LABEL_W, flexShrink: 0, pr: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </Typography>
              <Box sx={{ position: 'relative', flexGrow: 1, height: 22, borderRadius: 1, bgcolor: 'action.hover' }}>
                {ticks.map((t) => (
                  <Box key={t} sx={{ position: 'absolute', left: `${pos(t)}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${theme.palette.divider}` }} />
                ))}
                {showToday && (
                  <Box sx={{ position: 'absolute', left: `${pos(todayMs)}%`, top: -2, bottom: -2, borderLeft: '2px dashed #f43f5e', zIndex: 1 }} />
                )}
                <Tooltip title={`${item.label}: ${formatDate(item.start)} → ${formatDate(item.end)}${item.meta ? ` · ${item.meta}` : ''}`} arrow>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 3,
                      bottom: 3,
                      borderRadius: 1,
                      bgcolor: alpha(color, 0.85),
                      border: `1px solid ${color}`,
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      cursor: 'default',
                    }}
                  >
                    {width > 9 && (
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: 10.5 }}>
                        {days}d
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              </Box>
            </Stack>
          );
        })}
      </Stack>

      {showToday && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.75 }}>
          <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
            <Box component="span" sx={{ display: 'inline-block', width: 10, borderTop: '2px dashed #f43f5e', verticalAlign: 'middle', mr: 0.5 }} />
            Today ({todayIso && formatDate(todayIso)})
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
