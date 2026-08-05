import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import type { RouteOption } from '@/types';
import { OPTION_COLORS, MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { SourceRef } from '@/components/shared/Chips';
import { formatDistance, formatLitres, formatTonnes } from '@/utils/format';

/**
 * One route option, presented as a suggestion — CO₂e, transit, distance and
 * fuel side by side, with the workbook evidence that makes it real.
 *
 * Purely informative: there is no execution action here; the decision happens in
 * Terova's own booking systems. Freight cost and SLA risk are absent because the
 * workbook has no column for either.
 *
 * Which card is the optimised route is decided in the data, not here — exactly
 * one option per shipment carries `isOptimised`, and it is the booked route
 * itself whenever nothing the workbook records beats it.
 */
export function ScenarioCard({
  option,
  selected = false,
  onClick,
  taken = false,
  compact = false,
}: {
  option: RouteOption;
  selected?: boolean;
  onClick?: () => void;
  /** Mark this as the route actually taken (shipped freight — read-only). */
  taken?: boolean;
  /** Drop the fuel/proven facts and the evidence block, for tight spaces. */
  compact?: boolean;
}) {
  const color = OPTION_COLORS[option.kind] ?? '#64748b';
  const saves = option.co2eDeltaTonnes < 0;
  /** The booked route is itself the optimised one — nothing recorded beats it. */
  const alreadyOptimised = option.isOptimised && option.isCurrent;
  const distanceKm = option.legs.reduce((s, l) => s + l.distanceKm, 0);
  const fuelLitres = option.legs.reduce((s, l) => s + (l.fuelLitres ?? 0), 0);

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        borderColor: selected ? color : undefined,
        borderWidth: selected ? 2 : 1,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <Box sx={{ height: 4, bgcolor: color, borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color, fontWeight: 800, lineHeight: 1.25 }}>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {option.tagline}
            </Typography>
          </Box>
          <Stack spacing={0.5} alignItems="flex-end" sx={{ flexShrink: 0 }}>
            {option.isOptimised && (
              <Chip
                size="small"
                icon={<VerifiedRoundedIcon sx={{ fontSize: 14 }} />}
                label={alreadyOptimised ? 'Already optimised' : 'Optimised route'}
                title={
                  alreadyOptimised
                    ? 'The lowest-CO₂e routing the workbook records for this shipment is the one it was booked on'
                    : 'The lowest-CO₂e routing the workbook records for this shipment'
                }
                sx={{
                  bgcolor: alpha(alreadyOptimised ? '#5C6B72' : color, 0.14),
                  color: alreadyOptimised ? 'text.secondary' : color,
                  fontWeight: 800,
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            )}
            {option.isCurrent && (taken || !option.isOptimised) && (
              <Chip
                size="small"
                label={taken ? 'Route taken' : 'Today'}
                sx={{ bgcolor: alpha('#5C6B72', 0.16), fontWeight: 700 }}
              />
            )}
          </Stack>
        </Stack>

        {/* Mode chain — what actually changes about the journey */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
          {option.modePath.map((m, i) => (
            <Stack key={i} direction="row" spacing={0.4} alignItems="center">
              <ModeIcon mode={m} sx={{ fontSize: 16, color: MODE_COLORS[m] }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {m}
              </Typography>
              {i < option.modePath.length - 1 && (
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 12 }}>
                  ›
                </Box>
              )}
            </Stack>
          ))}
          {option.gateway && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              via {option.gateway}
            </Typography>
          )}
        </Stack>

        <Typography variant="h5" sx={{ mt: 1.5, fontWeight: 700 }}>
          {formatTonnes(option.co2eTonnes)}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            CO₂e / shipment
          </Typography>
        </Typography>
        {!option.isCurrent && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: saves ? 'success.main' : 'error.main' }}>
            {saves ? '↓' : '↑'} {formatTonnes(Math.abs(option.co2eDeltaTonnes))} ({Math.abs(Math.round(option.co2eDeltaPct))}%) vs
            today
          </Typography>
        )}

        {/* What the option costs, in what the workbook can actually tell us */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.5 }}>
          <OptionFact
            label="Transit"
            value={`~${option.transitDaysEst} days`}
            sub={
              option.isCurrent
                ? 'estimated'
                : option.transitDeltaDays === 0
                  ? 'no change'
                  : `${option.transitDeltaDays > 0 ? '+' : '−'}${Math.abs(option.transitDeltaDays)} days`
            }
          />
          <OptionFact label="Distance" value={formatDistance(distanceKm)} />
          {!compact && (
            <>
              <OptionFact label="Diesel" value={fuelLitres > 0 ? formatLitres(fuelLitres) : '—'} sub="road legs only" />
              <OptionFact
                label="Proven on"
                value={`${option.timesUsedInWorkbook} shipment${option.timesUsedInWorkbook === 1 ? '' : 's'}`}
              />
            </>
          )}
        </Box>

        {!compact && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Transit is estimated from workbook distances — no CO₂e depends on it
              </Typography>
            </Stack>

            <Box sx={{ mt: 1.25, p: 1, borderRadius: 1.5, bgcolor: alpha(color, 0.06), border: 1, borderColor: alpha(color, 0.2) }}>
              <Stack direction="row" spacing={0.6} alignItems="center">
                <VerifiedRoundedIcon sx={{ fontSize: 14, color }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
                >
                  {option.isCurrent ? 'Source' : 'Why this works'}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3, lineHeight: 1.5 }}>
                {option.evidence}
              </Typography>
              <SourceRef refs={option.evidenceRefs} />
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OptionFact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ px: 1, py: 0.75, borderRadius: 1.5, border: 1, borderColor: 'divider' }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11.5 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}
