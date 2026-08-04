import { Box, Button, Stack, Typography } from '@mui/material';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { ModeChip, SourceRef, StatusChip } from '@/components/shared/Chips';
import { LegTimeline } from './LegTimeline';
import { ScenarioCard } from './ScenarioCard';
import { RecommendationCard } from './RecommendationCard';
import { formatTonnes, formatIntensity, formatDate, formatWeightTonnes, formatDistance } from '@/utils/format';

/** One shipment, end to end — used by the drawer. */
export function ShipmentDetailContent({ shipmentId }: { shipmentId: string }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: s, status } = useAsync(() => ds.getShipment(shipmentId), [shipmentId]);

  if (status === 'loading') return <TableSkeleton rows={6} />;
  if (!s) return <Typography color="text.secondary">Shipment not found.</Typography>;

  const best = s.options.find((o) => !o.isCurrent);
  const facts: [string, string][] = [
    ['Product', s.productName],
    ['Category', `${s.category}${s.shu ? ` · ${s.shu.toLocaleString('en-US')} SHU` : ''}`],
    ['Route', [s.origin, s.icd, s.gateway, s.destPort].filter(Boolean).join(' → ')],
    ['Market', `${s.market} · ${s.region}`],
    ['Weight · container', `${formatWeightTonnes(s.weightTonnes)}${s.containerType ? ` · ${s.containerType}` : ''}`],
    ['Dispatch', `${formatDate(s.date)} · ${s.reportingYear}`],
    ['Distance · transit', `${formatDistance(s.totalDistanceKm)} · ~${s.transitDaysEst} days est.`],
  ];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">
          Shipment · {s.shipmentId}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {s.origin} → {s.destPort}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          <StatusChip status={s.status} />
          <ModeChip mode={s.primaryMode} />
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
            CO₂e
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {formatTonnes(s.co2eTonnes)} ({formatIntensity(s.co2ePerTonneKm)})
          </Typography>
        </Stack>
        {s.avoidableTonnes > 0.0005 && (
          <Typography variant="caption" color="success.main">
            {formatTonnes(s.avoidableTonnes)} avoidable via “{s.bestOptionLabel}” — a route the workbook already runs
          </Typography>
        )}
        <SourceRef refs={[s.sourceRef]} />
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Legs &amp; calculation
        </Typography>
        <LegTimeline legs={s.legs} />
      </Box>

      {s.options.length > 1 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Route options
          </Typography>
          <Stack spacing={1.5}>
            {s.options.map((o) => (
              <ScenarioCard key={o.id} option={o} recommended={!o.isCurrent && o.id === best?.id} compact />
            ))}
          </Stack>
        </Box>
      )}

      <Button variant="outlined" startIcon={<LaunchRoundedIcon />} onClick={() => dispatch(setSelectedLane(s.laneId))}>
        Open this lane
      </Button>

      {s.recommendations.length > 0 && (
        <Stack spacing={1.5}>
          {s.recommendations.map((r) => (
            <RecommendationCard key={r.id} rec={r} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
