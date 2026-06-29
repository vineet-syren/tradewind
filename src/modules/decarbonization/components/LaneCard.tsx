import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { Lane } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ApproachChip } from '@/components/shared/Chips';
import { formatTonnes } from '@/utils/format';

export function LaneCard({ lane, onClick, selected = false }: { lane: Lane; onClick?: () => void; selected?: boolean }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
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
          {lane.hasAirExceptions && <Chip size="small" color="error" variant="outlined" label="Air" sx={{ height: 20 }} />}
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
          {lane.modePath.map((m, i) => (
            <ModeIcon key={i} mode={m} sx={{ fontSize: 15, color: MODE_COLORS[m] }} />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {lane.shipmentCount} shipments · {lane.annualFrequency}/yr
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Realizable reduction
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.1 }}>
              {formatTonnes(lane.realizableReductionTonnes)}/yr
            </Typography>
            <Typography variant="caption" color="text.secondary">
              of {formatTonnes(lane.totalCo2eTonnes)} total · up to {lane.reductionPotentialPct}%
            </Typography>
          </Box>
          <ApproachChip kind={lane.recommendedApproach} />
        </Stack>
      </CardContent>
    </Card>
  );
}
