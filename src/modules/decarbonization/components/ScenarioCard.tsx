import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import type { Scenario } from '@/types';
import { APPROACH_COLORS, APPROACH_LABEL, MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { formatSignedCurrency, formatSignedPercent, formatTonnes } from '@/utils/format';

export function ScenarioCard({
  scenario,
  recommended = false,
  onAdopt,
  selected = false,
  onClick,
}: {
  scenario: Scenario;
  recommended?: boolean;
  onAdopt?: () => void;
  selected?: boolean;
  onClick?: () => void;
}) {
  const color = APPROACH_COLORS[scenario.kind];
  const isCurrent = scenario.kind === 'current';
  const savingPositive = scenario.co2eDeltaTonnes > 0;

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
          {recommended && <Chip size="small" label="Recommended" sx={{ bgcolor: alpha(color, 0.14), color, fontWeight: 700 }} />}
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
            / shipment
          </Typography>
        </Typography>
        {!isCurrent && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: savingPositive ? 'success.main' : 'error.main' }}>
            {savingPositive ? '↓' : '↑'} {formatSignedPercent(scenario.co2eDeltaPct)} vs current
          </Typography>
        )}

        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ScheduleRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {scenario.transitBand} · SLA risk: {scenario.slaRisk}
            </Typography>
          </Stack>
          {!isCurrent && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PaymentsRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Freight {formatSignedCurrency(scenario.costDeltaUsd)} vs current
              </Typography>
            </Stack>
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, minHeight: 32 }}>
          {scenario.narrative}
        </Typography>

        {onAdopt && !isCurrent && (
          <Button
            fullWidth
            size="small"
            variant={recommended ? 'contained' : 'outlined'}
            startIcon={<CheckCircleRoundedIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onAdopt();
            }}
            sx={{ mt: 1.5 }}
          >
            Adopt {APPROACH_LABEL[scenario.kind]}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
