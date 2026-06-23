import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import FlightRoundedIcon from '@mui/icons-material/FlightRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { SeverityChip } from '@/components/shared/Chips';
import { RecommendationCard } from '@/modules/decarbonization/components/RecommendationCard';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { executeRecommendation } from '@/app/store/actionsSlice';
import { setSelectedShipment } from '@/app/store/uiSlice';
import type { ExceptionItem, KpiMetric } from '@/types';
import { formatRelative, formatTonnes } from '@/utils/format';
import { APP_TODAY } from '@/constants/app';

export default function AirWatchPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { executedRecIds, dismissedRecIds } = useAppSelector((s) => s.actions);
  const { data: exceptions, status } = useAsync(() => ds.getExceptions({ filters }), [filters]);
  const { data: recs } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);

  const air = useMemo(() => (exceptions ?? []).filter((e) => e.kind === 'air'), [exceptions]);
  const dq = useMemo(() => (exceptions ?? []).filter((e) => e.kind === 'data-quality'), [exceptions]);
  const airRecs = useMemo(() => (recs ?? []).filter((r) => r.type === 'air-avoidance' && !dismissedRecIds.includes(r.id)), [recs, dismissedRecIds]);

  const [tab, setTab] = useState<'air' | 'dq' | 'actions'>('air');
  const [toast, setToast] = useState<string | null>(null);

  const avoidable = air.filter((e) => e.classification === 'Avoidable').length;
  const airCo2e = air.reduce((s, e) => s + e.co2eTonnes, 0);

  const kpis: KpiMetric[] = [
    { id: 'air', label: 'Air shipments', value: air.length, unit: 'number', intent: air.length ? 'negative' : 'positive', hint: 'flagged exceptions' },
    { id: 'avoid', label: 'Avoidable', value: avoidable, unit: 'number', intent: 'risk', hint: 'could ship by ocean' },
    { id: 'co2e', label: 'Air CO₂e', value: airCo2e, unit: 'tonnes', display: formatTonnes(airCo2e), intent: 'risk', hint: 'highest intensity mode' },
    { id: 'dq', label: 'Data-quality flags', value: dq.length, unit: 'number', intent: 'neutral', hint: 'blocked / needs data' },
  ];

  return (
    <Box>
      <PageHeader
        overline="Act · Mode Governance Agent"
        title="Air Watch & Exceptions"
        subtitle="Govern the carbon-heavy air movements and the data gaps. Classify air as avoidable or justified, shift what you can to ocean, and document the rest."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="air" label={`Air exceptions (${air.length})`} />
        <Tab value="actions" label={`Air-avoidance actions (${airRecs.length})`} />
        <Tab value="dq" label={`Data quality (${dq.length})`} />
      </Tabs>

      {status === 'loading' && <TableSkeleton rows={5} />}

      {tab === 'air' && status !== 'loading' && (
        <Stack spacing={1.5}>
          {air.length === 0 && <EmptyState title="No air exceptions" description="No air shipments in the current scope." icon={<FlightRoundedIcon sx={{ fontSize: 38 }} />} />}
          {air.map((e) => (
            <ExceptionCard key={e.id} item={e} onOpen={e.shipmentId ? () => dispatch(setSelectedShipment(e.shipmentId!)) : undefined} />
          ))}
        </Stack>
      )}

      {tab === 'actions' && (
        <Stack spacing={1.5}>
          {airRecs.length === 0 && <EmptyState title="No air-avoidance actions" description="Nothing to shift in the current scope." />}
          {airRecs.map((r) => (
            <RecommendationCard
              key={r.id}
              rec={r}
              executed={executedRecIds.includes(r.id)}
              onExecute={() => {
                dispatch(executeRecommendation(r));
                setToast(`Action queued · ${formatTonnes(r.estCo2eSavingTonnes)}/yr`);
              }}
              onOpenLane={r.shipmentId ? () => dispatch(setSelectedShipment(r.shipmentId!)) : undefined}
            />
          ))}
        </Stack>
      )}

      {tab === 'dq' && status !== 'loading' && (
        <Stack spacing={1.5}>
          {dq.map((e) => (
            <ExceptionCard key={e.id} item={e} />
          ))}
        </Stack>
      )}

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function ExceptionCard({ item, onOpen }: { item: ExceptionItem; onOpen?: () => void }) {
  const nowIso = `${APP_TODAY}T09:00:00Z`;
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
              <SeverityChip severity={item.severity} />
              <Chip size="small" variant="outlined" label={item.classification} color={item.classification === 'Avoidable' ? 'error' : item.classification === 'Justified' ? 'default' : 'warning'} />
              {item.co2eTonnes > 0 && <Chip size="small" variant="outlined" label={`${formatTonnes(item.co2eTonnes)} CO₂e`} />}
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {item.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.laneLabel !== '—' ? `${item.laneLabel} · ${item.customer} · ` : ''}{item.region} · {formatRelative(item.detectedAt, nowIso)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {item.detail}
            </Typography>
          </Box>
          {onOpen && (
            <Button size="small" variant="outlined" startIcon={<LaunchRoundedIcon />} onClick={onOpen} sx={{ flexShrink: 0 }}>
              Shipment
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
