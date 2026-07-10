import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import type { Scenario } from '@/types';
import { APPROACH_COLORS, APPROACH_LABEL, MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { formatCurrency, formatDistance, formatLitres, formatSignedCurrency, formatSignedPercent, formatTonnes } from '@/utils/format';

/**
 * One route option, presented as a suggestion — CO₂e, cost, SLA timeline,
 * distance and fuel side by side. Purely informative: there is no execution
 * action here; the decision happens in the customer's own booking systems.
 */
export function ScenarioCard({
  scenario,
  recommended = false,
  selected = false,
  onClick,
  taken = false,
}: {
  scenario: Scenario;
  recommended?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Mark this as the route actually taken (past shipments — read-only). */
  taken?: boolean;
}) {
  const color = APPROACH_COLORS[scenario.kind];
  const isCurrent = scenario.kind === 'current';
  const savingPositive = scenario.co2eDeltaTonnes > 0;
  const distanceKm = scenario.legs.reduce((s, l) => s + l.distanceKm, 0);
  const fuelLitres = scenario.legs.reduce((s, l) => s + l.fuelLitres, 0);

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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="overline" sx={{ color }}>
              {APPROACH_LABEL[scenario.kind]}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {scenario.tagline}
            </Typography>
          </Box>
          {taken ? (
            <Chip size="small" label="Route taken" sx={{ bgcolor: alpha('#5C6B72', 0.16), color: 'text.primary', fontWeight: 700 }} />
          ) : recommended ? (
            <Chip size="small" label="Suggested" sx={{ bgcolor: alpha(color, 0.14), color, fontWeight: 700 }} />
          ) : null}
        </Stack>

        {/* Mode path */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }}>
          {scenario.modePath.map((m, i) => (
            <Stack key={i} direction="row" spacing={0.5} alignItems="center">
              <ModeIcon mode={m} sx={{ fontSize: 16, color: MODE_COLORS[m] }} />
              {i < scenario.modePath.length - 1 && (
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 12 }}>
                  ›
                </Box>
              )}
            </Stack>
          ))}
        </Stack>

        <Typography variant="h5" sx={{ mt: 1.5, fontWeight: 700 }}>
          {formatTonnes(scenario.co2eTonnes)}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            CO₂e / shipment
          </Typography>
        </Typography>
        {!isCurrent && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: savingPositive ? 'success.main' : 'error.main' }}>
            {savingPositive ? '↓' : '↑'} {formatSignedPercent(scenario.co2eDeltaPct)} vs current
          </Typography>
        )}

        {/* The full economics of this option, side by side */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.5 }}>
          <OptionFact label="Freight cost" value={formatCurrency(scenario.freightUsd)} sub={!isCurrent ? `${formatSignedCurrency(scenario.costDeltaUsd)} vs current` : undefined} />
          <OptionFact label="Transit" value={`${Math.round(scenario.transitDays)} days`} sub={scenario.transitBand} />
          <OptionFact label="Distance" value={formatDistance(distanceKm)} />
          <OptionFact label="Fuel" value={formatLitres(fuelLitres)} />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
          <ScheduleRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            SLA risk: {scenario.slaRisk}
          </Typography>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
          {scenario.narrative}
        </Typography>
      </CardContent>
    </Card>
  );
}

function OptionFact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ px: 1, py: 0.75, borderRadius: 1.5, border: 1, borderColor: 'divider' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5, display: 'block' }}>
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
