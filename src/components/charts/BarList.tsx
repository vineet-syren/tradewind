import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export interface BarListItem {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

/** A compact horizontal bar list — ideal for ranked hotspots. */
export function BarList({
  items,
  valueFormatter,
  color = '#10b981',
  onSelect,
  maxHeight,
}: {
  items: BarListItem[];
  valueFormatter: (v: number) => string;
  color?: string;
  onSelect?: (item: BarListItem) => void;
  /** Cap the list and scroll inside it — see the note on `IntensityRanking`. */
  maxHeight?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <Stack spacing={1.25} sx={maxHeight ? { maxHeight, overflowY: 'auto', pr: 0.75 } : undefined}>
      {items.map((item) => {
        const c = item.color ?? color;
        return (
          <Box
            key={item.label}
            onClick={onSelect ? () => onSelect(item) : undefined}
            sx={{ cursor: onSelect ? 'pointer' : 'default', '&:hover .tw-bar': onSelect ? { opacity: 0.85 } : {} }}
          >
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500, maxWidth: '70%' }}>
                {item.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: c }}>
                {valueFormatter(item.value)}
              </Typography>
            </Stack>
            <Box sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: alpha(c, 0.12) }}>
              <Box
                className="tw-bar"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: `${(item.value / max) * 100}%`,
                  borderRadius: 4,
                  bgcolor: c,
                  transition: 'width .4s ease',
                }}
              />
            </Box>
            {item.sub && (
              <Typography variant="caption" color="text.secondary">
                {item.sub}
              </Typography>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
