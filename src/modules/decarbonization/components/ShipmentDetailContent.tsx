import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch } from '@/app/store/hooks';
import { executeRecommendation } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { ModeChip, SeverityChip } from '@/components/shared/Chips';
import { LegTimeline } from './LegTimeline';
import { RecommendationCard } from './RecommendationCard';
import { formatCurrency, formatTonnes } from '@/utils/format';

export function ShipmentDetailContent({ shipmentId, onToast }: { shipmentId: string; onToast: (m: string) => void }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: s, status } = useAsync(() => ds.getShipment(shipmentId), [shipmentId]);

  if (status === 'loading') return <TableSkeleton rows={6} />;
  if (!s) return <Typography color="text.secondary">Shipment not found.</Typography>;

  const facts: [string, string][] = [
    ['Product', `${s.productName}`],
    ['Customer', `${s.customer} · ${s.market}`],
    ['Route', `${s.origin} → ${s.originPort} → ${s.destPort} → ${s.destCity}`],
    ['Vendor / processor', s.vendor],
    ['LSP / carrier', `${s.lsp} · ${s.carrier}`],
    ['Weight', `${s.weightTonnes} t${s.isConsolidated ? ` (${s.weightSharePct}% share, consolidated)` : ''}`],
    ['Period · trips', `${s.period} · ${s.monthlyTrips}/mo`],
    ['Freight · transit', `${formatCurrency(s.freightUsd)} · ${s.transitDays} days`],
  ];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">
          Shipment 360 · {s.shipmentId}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {s.origin} → {s.destCity}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          <ModeChip mode={s.primaryMode} />
          {s.airException && <SeverityChip severity={s.airAvoidable ? 'High' : 'Medium'} />}
          {s.airException && <Chip size="small" variant="outlined" label={s.airAvoidable ? 'Air · avoidable' : 'Air · justified'} />}
          <Chip size="small" variant="outlined" label={`Data: ${s.dataConfidence}`} />
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr' }}>
        {facts.map(([k, v]) => (
          <Stack key={k} direction="row" justifyContent="space-between" spacing={2}>
            <Typography variant="caption" color="text.secondary">
              {k}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {v}
            </Typography>
          </Stack>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Attributed CO₂e
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {formatTonnes(s.co2eTonnes)} ({s.co2ePerTonne} t/t)
          </Typography>
        </Stack>
        {s.realizedReductionPct > 0 && (
          <Typography variant="caption" color="success.main">
            {s.realizedReductionPct}% already realized vs gross {formatTonnes(s.co2eGrossTonnes)}
          </Typography>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Leg breakdown &amp; calculation
        </Typography>
        <LegTimeline legs={s.legs} />
      </Box>

      <ChartContainer title="What-if: route &amp; mode" subtitle="CO₂e per shipment by approach">
        <ScenarioCompareChart scenarios={s.scenarios} />
      </ChartContainer>

      <Button variant="outlined" startIcon={<LaunchRoundedIcon />} onClick={() => dispatch(setSelectedLane(s.laneId))}>
        Open lane corridor 360
      </Button>

      {s.recommendations.length > 0 && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Reduction actions
          </Typography>
          <Stack spacing={1.5}>
            {s.recommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                onExecute={() => {
                  dispatch(executeRecommendation(r));
                  onToast(`Action queued · ${r.title}`);
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
