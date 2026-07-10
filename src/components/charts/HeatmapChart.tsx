import { Box, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatTonnes } from '@/utils/format';

const LABEL_W = 110;
const CELL_MIN_W = 46;

/**
 * Matrix heat map — rows × cols grid with cell intensity scaled to the max value.
 * Scrolls horizontally when there are more columns than fit; row labels stay pinned.
 */
export function HeatmapChart({
  rows,
  cols,
  values,
  height,
  fitHeight,
  valueFormatter = formatTonnes,
  baseColor,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  height?: number;
  /** Fixed height to FILL — rows stretch so the matrix occupies the whole card. */
  fitHeight?: number;
  valueFormatter?: (v: number) => string;
  baseColor?: string;
}) {
  const theme = useTheme();
  const color = baseColor ?? theme.palette.primary.main;
  const max = Math.max(...values.flat(), 0.001);

  const stickySx = {
    position: 'sticky' as const,
    left: 0,
    zIndex: 1,
    bgcolor: 'background.paper',
  };

  return (
    <Box
      role="img"
      aria-label={`Heat map of ${rows.join(', ')} across ${cols.length} periods; largest value ${valueFormatter(max)}`}
      sx={{ height: fitHeight, maxHeight: fitHeight ?? height, overflow: 'auto', pb: 0.5 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_W}px repeat(${cols.length}, minmax(${CELL_MIN_W}px, 1fr))`,
          // With fitHeight the data rows stretch equally so no dead space remains.
          gridTemplateRows: fitHeight ? `auto repeat(${rows.length}, 1fr)` : undefined,
          height: fitHeight ? '100%' : undefined,
          gap: 0.5,
          alignItems: 'stretch',
          minWidth: LABEL_W + cols.length * (CELL_MIN_W + 4),
        }}
      >
        <Box sx={stickySx} />
        {cols.map((c) => (
          <Typography key={c} variant="caption" sx={{ color: 'text.secondary', fontSize: 11.5, textAlign: 'center', alignSelf: 'end', whiteSpace: 'nowrap' }}>
            {c}
          </Typography>
        ))}
        {rows.map((r, ri) => (
          <Box key={r} sx={{ display: 'contents' }}>
            <Typography
              variant="caption"
              sx={{ ...stickySx, fontWeight: 600, alignSelf: 'stretch', display: 'flex', alignItems: 'center', pr: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {r}
            </Typography>
            {cols.map((c, ci) => {
              const v = values[ri]?.[ci] ?? 0;
              const strength = v / max;
              const bg = v > 0 ? alpha(color, 0.06 + 0.84 * strength) : 'transparent';
              return (
                <Tooltip key={c} title={`${r} · ${c}: ${valueFormatter(v)}`} arrow>
                  <Box
                    sx={{
                      borderRadius: 1,
                      bgcolor: bg,
                      border: 1,
                      borderColor: v > 0 ? 'transparent' : 'divider',
                      minHeight: 30,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'default',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: strength > 0.55 ? '#fff' : v > 0 ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {v > 0 ? valueFormatter(v) : '–'}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
