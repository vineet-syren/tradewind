import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { Lane } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ApproachChip } from '@/components/shared/Chips';
import { formatTonnes } from '@/utils/format';

export type LaneRankKey = 'reduction' | 'co2e' | 'shipments' | 'pct';

export function LaneCard({
  lane,
  onClick,
  selected = false,
  rankBy = 'reduction',
}: {
  lane: Lane;
  onClick?: () => void;
  selected?: boolean;
  rankBy?: LaneRankKey;
}) {
  // All KPIs are always shown; the active "Rank by" one is highlighted.
  const kpis: { key: LaneRankKey; label: string; value: string }[] = [
    { key: 'reduction', label: 'Savings / yr', value: formatTonnes(lane.realizableReductionTonnes) },
    { key: 'pct', label: 'Reduction %', value: `${lane.reductionPotentialPct}%` },
    { key: 'co2e', label: 'Total CO₂e', value: formatTonnes(lane.totalCo2eTonnes) },
    { key: 'shipments', label: 'Shipments', value: `${lane.shipmentCount} · ${lane.annualFrequency}/yr` },
  ];

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : 1,
        borderStyle: 'solid',
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
              {lane.origin} <ArrowForwardRoundedIcon sx={{ fontSize: 13, verticalAlign: 'middle', color: 'text.disabled' }} /> {lane.destPort}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {lane.productCategory} · {lane.customer}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {lane.hasAirExceptions && <Chip size="small" color="error" variant="outlined" label="Air" sx={{ height: 20 }} />}
            <ApproachChip kind={lane.recommendedApproach} />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
          {lane.modePath.map((m2, i) => (
            <ModeIcon key={i} mode={m2} sx={{ fontSize: 15, color: MODE_COLORS[m2] }} />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {lane.modePath.join(' → ')}
          </Typography>
        </Stack>

        {/* All KPIs shown; the ranked one is spotlighted */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.25 }}>
          {kpis.map((k) => {
            const active = k.key === rankBy;
            return (
              <Box
                key={k.key}
                sx={{
                  px: 1,
                  py: 0.6,
                  borderRadius: 1.25,
                  bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.1) : 'transparent'),
                  border: (t) => `1px solid ${active ? alpha(t.palette.primary.main, 0.35) : t.palette.divider}`,
                }}
              >
                <Typography sx={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: active ? 'primary.main' : 'text.secondary' }}>
                  {k.label}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.15, color: active ? 'primary.main' : 'text.primary' }}>
                  {k.value}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
