import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { formatIntensity } from '@/utils/format';

export interface IntensityRow {
  label: string;
  value: number; // g CO₂e / t·km
  sub?: string;
}

// Efficiency tiers (worst → best) keyed off the row's position in the range.
const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#10b981';

/**
 * Ranked horizontal bars for transport intensity (g CO₂e/t·km), least efficient
 * first. Bars are colour-graded red → green by efficiency and carry a dashed
 * fleet-average marker, so the worst offenders read instantly.
 */
export function IntensityRanking({ items, avg }: { items: IntensityRow[]; avg?: number }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.value), avg ?? 0) * 1.08 || 1;
  const min = Math.min(...items.map((i) => i.value));
  const tierColor = (v: number) => {
    const t = (v - min) / Math.max(max - min, 0.001);
    return t > 0.6 ? RED : t > 0.3 ? AMBER : GREEN;
  };
  return (
    <Stack spacing={1.4}>
      {items.map((it) => {
        const color = tierColor(it.value);
        return (
          <Box key={it.label}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{it.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatIntensity(it.value)}
              </Typography>
            </Stack>
            <Box sx={{ position: 'relative', mt: 0.5, height: 8, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', inset: 0, width: `${Math.min(100, (it.value / max) * 100)}%`, bgcolor: color, borderRadius: 999 }} />
            </Box>
            {it.sub && (
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{it.sub}</Typography>
            )}
          </Box>
        );
      })}
      {avg != null && (
        <Tooltip title="Network average intensity">
          <Box sx={{ position: 'relative', height: 18, mt: 0.5 }}>
            <Box sx={{ position: 'absolute', left: `${Math.min(100, (avg / max) * 100)}%`, top: 0, bottom: 0, borderLeft: '2px dashed', borderColor: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: `calc(${Math.min(100, (avg / max) * 100)}% + 4px)`, top: 0, whiteSpace: 'nowrap' }}>
              avg {formatIntensity(avg)}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
}
