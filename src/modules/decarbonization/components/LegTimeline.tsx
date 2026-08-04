import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Leg } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { formatDistance, formatLitres, formatTonnes } from '@/utils/format';

/**
 * Leg-by-leg journey with the CO₂e arithmetic written out.
 *
 * The calculation line differs by mode on purpose: road is charged per truck
 * kilometre (no weight term), everything else per tonne-kilometre. Seeing that
 * difference is what explains why a 400 kg load can cost what a 25 t one does.
 */
export function LegTimeline({ legs, showCalc = true }: { legs: Leg[]; showCalc?: boolean }) {
  return (
    <Stack spacing={0}>
      {legs.map((leg, i) => {
        const color = MODE_COLORS[leg.modeLabel] ?? '#888';
        const last = i === legs.length - 1;
        const perTruck = leg.efBasis === 'per-truck-km';
        return (
          <Stack key={`${leg.seq}-${leg.from}-${leg.to}`} direction="row" spacing={1.5}>
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
                <Typography variant="body2" sx={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                  {formatTonnes(leg.co2eTonnes)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {leg.modeLabel} · {formatDistance(leg.distanceKm)}
                {leg.distanceNm ? ` (${Math.round(leg.distanceNm).toLocaleString('en-US')} nm)` : ''}
                {leg.fuelLitres ? ` · ${formatLitres(leg.fuelLitres)} ${leg.fuelType ?? ''}` : ''}
                {/* A 51 km run is well under a day — "~0d" would read as an error. */}
                {leg.transitDaysEst < 1 ? ' · under a day' : ` · ~${Math.round(leg.transitDaysEst)}d est.`}
              </Typography>
              {showCalc && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontFamily: 'monospace', fontSize: 10.5, mt: 0.25 }}
                  >
                    {perTruck
                      ? `${formatDistance(leg.distanceKm)} × ${leg.emissionFactor} kg/km = ${formatTonnes(leg.co2eTonnes)}`
                      : `${leg.weightTonnes} t × ${formatDistance(leg.distanceKm)} × ${leg.emissionFactor} = ${formatTonnes(leg.co2eTonnes)}`}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: 10.5, color: 'text.disabled' }}>
                    {perTruck ? 'charged per truck run — the load does not change it' : 'charged per tonne carried'}
                    {' · '}
                    <Box component="span" sx={{ fontFamily: 'monospace' }}>
                      {leg.sourceRef}
                    </Box>
                  </Typography>
                </>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
