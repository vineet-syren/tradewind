import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { RouteOption } from '@/types';
import { MODE_COLORS, OPTION_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { SourceRef } from '@/components/shared/Chips';
import { formatDistance, formatTonnes } from '@/utils/format';

/**
 * One route option, presented as a suggestion.
 *
 * Purely informative — there is no booking action here; the decision is made in
 * Terova's own systems. What the card must do is make the trade-off obvious in
 * one glance and name the workbook evidence that makes the option real.
 */
export function RouteOptionCard({
  option,
  selected = false,
  recommended = false,
  onClick,
  compact = false,
}: {
  option: RouteOption;
  selected?: boolean;
  /** Mark the lowest-CO₂e option so the eye lands on it first. */
  recommended?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const color = OPTION_COLORS[option.kind] ?? '#64748b';
  const saves = option.co2eDeltaTonnes < 0;

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
      <CardContent sx={compact ? { py: 1.5, '&:last-child': { pb: 1.5 } } : undefined}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            {/* Not `overline`: its wide letter-spacing wraps these labels badly in
                a narrow column, and the label carries the port name. */}
            <Typography variant="subtitle2" sx={{ color, fontWeight: 800, lineHeight: 1.25 }}>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {option.tagline}
            </Typography>
          </Box>
          {option.isCurrent ? (
            <Chip size="small" label="Today" sx={{ bgcolor: alpha('#5C6B72', 0.16), fontWeight: 700, flexShrink: 0 }} />
          ) : recommended ? (
            <Chip
              size="small"
              icon={<CheckCircleRoundedIcon sx={{ fontSize: 15, color: 'inherit !important' }} />}
              label="Suggested"
              sx={{ bgcolor: alpha(color, 0.14), color, fontWeight: 700, flexShrink: 0 }}
            />
          ) : null}
        </Stack>

        {/* Mode chain — what actually changes about the journey */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.25, flexWrap: 'wrap' }} useFlexGap>
          {option.modePath.map((m, i) => (
            <Stack key={i} direction="row" spacing={0.4} alignItems="center">
              <ModeIcon mode={m} sx={{ fontSize: 16, color: MODE_COLORS[m] }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {m}
              </Typography>
              {i < option.modePath.length - 1 && (
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 12, px: 0.25 }}>
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

        <Typography variant="h5" sx={{ mt: 1.25, fontWeight: 700 }}>
          {formatTonnes(option.co2eTonnes)}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            CO₂e
          </Typography>
        </Typography>
        {!option.isCurrent && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: saves ? 'success.main' : 'error.main' }}>
            {saves ? '↓' : '↑'} {formatTonnes(Math.abs(option.co2eDeltaTonnes))} ({Math.abs(Math.round(option.co2eDeltaPct))}%) vs today
          </Typography>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.25 }}>
          <Fact
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
          <Fact label="Distance" value={formatDistance(option.distanceKm)} />
        </Box>

        {!compact && (
          <Box sx={{ mt: 1.25, p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Typography
              variant="caption"
              sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}
            >
              {option.isCurrent ? 'Source' : `Why this works · already used on ${option.timesUsedInWorkbook} shipment${option.timesUsedInWorkbook === 1 ? '' : 's'}`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {option.evidence}
            </Typography>
            <SourceRef refs={option.evidenceRefs} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
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
