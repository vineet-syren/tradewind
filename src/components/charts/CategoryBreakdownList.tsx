import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import NorthEastRounded from '@mui/icons-material/NorthEastRounded';
import type { InventoryCategory, DataQuality } from '@/types';
import { SCOPE_COLORS, SCOPE_SHORT } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const DQ_META: Record<DataQuality, { label: string; color: string }> = {
  primary: { label: 'Primary data', color: '#2E8B6F' },
  secondary: { label: 'Secondary data', color: '#C8841B' },
  estimated: { label: 'Estimated', color: '#98A0B3' },
};

/**
 * Ranked horizontal bars for inventory categories — bar length ∝ CO₂e, coloured
 * by scope, with a data-quality dot and a jump to the deep module for Cat 9.
 */
export function CategoryBreakdownList({ categories }: { categories: InventoryCategory[] }) {
  const theme = useTheme();
  const shown = categories.filter((c) => c.relevant);
  const max = Math.max(1, ...shown.map((c) => c.co2eTonnes));

  return (
    <Stack spacing={1.25}>
      {shown.map((c) => {
        const color = SCOPE_COLORS[c.scope];
        const dq = DQ_META[c.dataQuality];
        return (
          <Box key={c.id}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mb: 0.4 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.categoryNumber ? `${c.categoryNumber}. ` : ''}
                  {c.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                  {SCOPE_SHORT[c.scope]}
                </Typography>
                {c.trackedHere && (
                  <Chip
                    component={RouterLink}
                    to="/control-tower"
                    clickable
                    size="small"
                    icon={<NorthEastRounded sx={{ fontSize: 13 }} />}
                    label="Measured in Transportation"
                    sx={{ height: 20, fontSize: 10.5, fontWeight: 600, '& .MuiChip-icon': { ml: 0.5 } }}
                  />
                )}
              </Stack>
              <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatTonnes(c.co2eTonnes)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 38, textAlign: 'right' }}>
                  {c.pct}%
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flexGrow: 1, height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.06), overflow: 'hidden' }}>
                <Box sx={{ width: `${(c.co2eTonnes / max) * 100}%`, height: '100%', bgcolor: color, borderRadius: 999 }} />
              </Box>
              <Tooltip title={`${dq.label} · ${c.method}`}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dq.color, flexShrink: 0 }} />
              </Tooltip>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
