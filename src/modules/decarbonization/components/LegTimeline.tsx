import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Leg } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { formatDistance, formatTonnes } from '@/utils/format';

/** Leg-by-leg journey with the full CO₂e calculation made transparent. */
export function LegTimeline({ legs, showCalc = true }: { legs: Leg[]; showCalc?: boolean }) {
  return (
    <Stack spacing={0}>
      {legs.map((leg, i) => {
        const color = MODE_COLORS[leg.modeLabel] ?? '#888';
        const last = i === legs.length - 1;
        return (
          <Stack key={leg.seq} direction="row" spacing={1.5}>
            {/* Rail / connector */}
            <Stack alignItems="center" sx={{ width: 34 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  bgcolor: alpha(color, 0.12),
                  border: `1.5px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ModeIcon mode={leg.modeLabel} sx={{ fontSize: 17, color }} />
              </Box>
              {!last && <Box sx={{ width: 2, flexGrow: 1, minHeight: 22, bgcolor: 'divider', my: 0.25 }} />}
            </Stack>

            <Box sx={{ pb: last ? 0 : 2, flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {leg.from} → {leg.to}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                  {formatTonnes(leg.co2eTonnes)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {leg.modeLabel} · {leg.vehicleType} · {formatDistance(leg.distanceKm)} ({leg.distanceTier})
              </Typography>
              {showCalc && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace', fontSize: 10.5, mt: 0.25 }}>
                  {leg.weightTonnes} t × {formatDistance(leg.distanceKm)} × {leg.emissionFactor} = {formatTonnes(leg.co2eTonnes)}
                </Typography>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
