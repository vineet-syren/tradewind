import { type ReactNode } from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { WorldMap } from '@/components/map/WorldMap';
import { ScenarioCard } from './ScenarioCard';
import { RecommendationCard } from './RecommendationCard';
import { formatTonnes, formatIntensity, formatWeightTonnes } from '@/utils/format';

/** Everything about one lane: its numbers, its options, and what to change. */
export function LaneDetailContent({ laneId }: { laneId: string }) {
  const ds = useDataSource();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);

  if (status === 'loading') return <TableSkeleton rows={6} />;
  if (!lane) return <Typography color="text.secondary">Lane not found.</Typography>;

  const current = lane.options.find((o) => o.isCurrent);
  const best = lane.options.find((o) => o.isOptimised && !o.isCurrent);
  const cutPct =
    current && best && current.co2eTonnes > 0
      ? Math.round(((current.co2eTonnes - best.co2eTonnes) / current.co2eTonnes) * 100)
      : 0;
  const suggestions = [...lane.recommendations].sort((a, b) => b.priorityScore - a.priorityScore);
  const openSuggestions = suggestions.filter((r) => r.shipmentId?.startsWith('PLN'));

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">
          Lane · {lane.category}
        </Typography>
        <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mt: 0.25 }}>
          <LabelledPlace name={lane.origin} label="Origin" />
          <Box component="span" sx={{ fontSize: 22, color: 'text.secondary', mt: 0.3 }}>
            →
          </Box>
          <LabelledPlace name={lane.destPort} label={`Destination · ${lane.destCountry}`} />
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Metric label="Total CO₂e" value={formatTonnes(lane.totalCo2eTonnes)} />
        <Metric label="Avoidable on optimised routes" value={formatTonnes(lane.avoidableTonnes)} accent />
        <Metric label="Shipments" value={`${lane.shipmentCount}${lane.plannedShipmentCount ? ` · ${lane.plannedShipmentCount} to plan` : ''}`} />
        <Metric label="Intensity" value={formatIntensity(lane.avgCo2ePerTonneKm)} />
        <Metric label="Gateways used" value={lane.gateways.join(' / ') || '—'} />
        <Metric label="Average load" value={formatWeightTonnes(lane.avgWeightTonnes)} />
      </Box>

      {/* The plain-English story of this route, computed from its own numbers */}
      <Card
        sx={{
          border: 1,
          borderColor: (t) => alpha(t.palette.primary.main, 0.35),
          background: (t) => `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${t.palette.background.paper} 65%)`,
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AutoAwesomeRounded sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              What this lane looks like
            </Typography>
            <Chip size="small" variant="outlined" color="primary" label="Computed from the workbook" sx={{ ml: 'auto' }} />
          </Stack>
          <Stack spacing={0.75}>
            <Brief>
              <b>{lane.shipmentCount}</b> shipment{lane.shipmentCount === 1 ? '' : 's'} moved <b>{formatWeightTonnes(lane.totalWeightTonnes)}</b> on this
              lane for <b>{formatTonnes(lane.totalCo2eTonnes)}</b> of CO₂e, mostly by {lane.primaryMode.toLowerCase()} via{' '}
              <b>{lane.primaryGateway}</b>.
            </Brief>
            {current && best ? (
              <Brief>
                A representative shipment emits <b>{formatTonnes(current.co2eTonnes)}</b> today. Via <b>{best.label}</b> it would
                emit <b>{formatTonnes(best.co2eTonnes)}</b>
                {cutPct > 0 ? (
                  <>
                    {' '}
                    — about <b>{cutPct}% less</b>
                  </>
                ) : null}
                . Across every shipment on the lane that is <b>{formatTonnes(lane.avoidableTonnes)}</b>.
              </Brief>
            ) : (
              <Brief>
                This lane is already on its optimised route. Every other routing the workbook records for these ports costs at
                least what the current one does.
              </Brief>
            )}
            {lane.hasAirFreight && (
              <Brief>
                <b>{lane.airShipmentCount}</b> shipment{lane.airShipmentCount === 1 ? '' : 's'} on this lane flew. Air is charged at 188× the
                sea factor per tonne carried, so that is where to look first.
              </Brief>
            )}
            {lane.plannedShipmentCount > 0 && (
              <Brief>
                <b>{lane.plannedShipmentCount}</b> shipment{lane.plannedShipmentCount === 1 ? '' : 's'} on this lane are still to be planned,
                carrying <b>{formatTonnes(lane.plannedAvoidableTonnes)}</b> of that saving.
              </Brief>
            )}
          </Stack>
        </CardContent>
      </Card>

      {lane.options.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Routes on the map
          </Typography>
          <WorldMap options={lane.options} selectedOptionId={best?.id ?? current?.id} height={300} />
        </Box>
      )}

      {lane.options.length > 1 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Route optimisation
          </Typography>
          <Stack spacing={1.5}>
            {lane.options.map((o) => (
              <ScenarioCard key={o.id} option={o} />
            ))}
          </Stack>
        </Box>
      )}

      {openSuggestions.length > 0 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Decisions still open on this lane
            </Typography>
            <Chip size="small" label={openSuggestions.length} />
          </Stack>
          <Stack spacing={1.5}>
            {openSuggestions.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function LabelledPlace({ name, label }: { name: string; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap>
        {name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function Brief({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.9, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
        {children}
      </Typography>
    </Stack>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: accent ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
