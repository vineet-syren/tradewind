import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, MenuItem, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { WorldMap } from '@/components/map/WorldMap';
import { ValueHero, type HeroPart } from '@/components/cards/ValueHero';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScenarioCard } from '@/modules/decarbonization/components/ScenarioCard';
import { LegTimeline } from '@/modules/decarbonization/components/LegTimeline';
import { ShipmentLedgerSection } from '@/modules/decarbonization/components/ShipmentLedgerSection';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { adoptDecision } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { ActionType, ApproachKind, LaneDetail, Scenario, Shipment } from '@/types';
import { formatTonnes, formatIntensity, formatDistance, formatCurrency, formatWeightTonnes, formatDate } from '@/utils/format';

const ROUTE_COUNTS = [5, 8, 12, 16];
type ScenarioKind = 'current' | 'best' | 'balanced' | 'optimal';

const TYPE_LABEL: Record<string, string> = {
  'mode-shift': 'mode shift',
  'air-avoidance': 'air-freight avoidance',
  'consolidation': 'consolidation',
  'route-swap': 'route optimization',
  'origin-port': 'greener gateways',
  'lsp-swap': 'carrier switches',
  'vendor-intervention': 'vendor governance',
};

export default function ShipmentAtlasPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'reduction' }), [filters]);
  const { data: recs } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);

  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [chosenKind, setChosenKind] = useState<ScenarioKind>('current');
  const [toast, setToast] = useState<string | null>(null);
  const [routeCount, setRouteCount] = useState(8);
  const mapRef = useRef<HTMLDivElement>(null);

  const mapLanes = useMemo(() => lanes?.slice(0, routeCount) ?? [], [lanes, routeCount]);

  // "Value on the table" — total avoidable CO₂e across the open reduction backlog,
  // with its top categories, so the miss is obvious at a glance.
  const hero = useMemo(() => {
    const open = recs ?? [];
    // Honest, feasibility-tempered realizable reduction (not the inflated backlog).
    const total = (lanes ?? []).reduce((s, l) => s + l.realizableReductionTonnes, 0);
    const recTotal = open.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
    const byType = new Map<ActionType, number>();
    for (const r of open) byType.set(r.type, (byType.get(r.type) ?? 0) + r.estCo2eSavingTonnes);
    // Split the realizable total across the top action categories by their share.
    const parts: HeroPart[] = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, v]) => ({ label: TYPE_LABEL[t] ?? t, tonnes: recTotal > 0 ? (v / recTotal) * total : 0 }));
    return { total, parts, recCount: open.length };
  }, [lanes, recs]);

  useEffect(() => {
    if (selectedLaneId && lanes && !lanes.find((l) => l.laneId === selectedLaneId)) {
      setSelectedLaneId(null);
      setSelectedShipment(null);
    }
  }, [lanes, selectedLaneId]);

  const selectShipment = (s: Shipment) => {
    setSelectedShipment(s);
    setSelectedLaneId(s.laneId);
    setChosenKind('current'); // start from the route as-is
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const selectLaneFromMap = (laneId: string) => {
    setSelectedLaneId(laneId);
    setSelectedShipment(null);
    setChosenKind('current');
  };
  const activeLaneId = selectedShipment?.laneId ?? selectedLaneId;
  // Past shipments (already shipped) are read-only; upcoming (Planned) let you choose.
  const isPast = Boolean(selectedShipment && selectedShipment.status !== 'Planned');

  return (
    <Box>
      <PageHeader
        overline="Visibility · End-to-end shipments"
        title="Shipment Atlas"
        subtitle="The whole outbound network in one place — trace routes on the map, read every shipment in the register, and select one to compare its Fastest / Balanced / Best-for-CO₂ options with the full 360 breakdown."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <ValueHero totalTonnes={hero.total} parts={hero.parts} recCount={hero.recCount} />

      <Box ref={mapRef}>
        <ChartContainer
          title="Outbound shipment network"
          subtitle={
            activeLaneId
              ? 'Tracing the selected shipment route'
              : `Showing the top ${mapLanes.length} of ${lanes?.length ?? 0} lanes · click one to trace its full route`
          }
          action={
            !activeLaneId && lanes ? (
              <TextField select size="small" label="Routes shown" value={routeCount} onChange={(e) => setRouteCount(Number(e.target.value))} sx={{ width: 150 }}>
                {ROUTE_COUNTS.map((n) => (
                  <MenuItem key={n} value={n}>Top {n} lanes</MenuItem>
                ))}
              </TextField>
            ) : undefined
          }
        >
          {status === 'loading' ? (
            <ChartSkeleton height={420} />
          ) : (
            <WorldMap lanes={mapLanes} selectedLaneId={activeLaneId} scenarioKind={chosenKind} onSelectLane={selectLaneFromMap} onClear={() => { setSelectedLaneId(null); setSelectedShipment(null); setChosenKind('current'); }} height={460} />
          )}
        </ChartContainer>
      </Box>

      {/* Register (left) · detail on selection (right) */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mt: 3, alignItems: 'start' }}>
        <ShipmentLedgerSection compact onRowSelect={selectShipment} selectedId={selectedShipment?.shipmentId} />

        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          {selectedShipment ? (
            <Stack spacing={2}>
              <ShipmentFactsCard s={selectedShipment} />
              <DecisionPanel laneId={selectedShipment.laneId} chosenKind={chosenKind} onChooseKind={setChosenKind} readOnly={isPast} onAdopt={(m) => setToast(m)} onOpen360={() => dispatch(setSelectedLane(selectedShipment.laneId))} />
            </Stack>
          ) : selectedLaneId ? (
            <DecisionPanel laneId={selectedLaneId} chosenKind={chosenKind} onChooseKind={setChosenKind} readOnly={false} onAdopt={(m) => setToast(m)} onOpen360={() => dispatch(setSelectedLane(selectedLaneId))} />
          ) : (
            <Card sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
              <CardContent>
                <EmptyState title="Select a shipment" description="Pick a shipment in the register on the left — or a lane on the map — to see its route, the Best-for-CO₂ / Balanced / Fastest options and the full 360 breakdown." />
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, display: 'block' }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

function ShipmentFactsCard({ s }: { s: Shipment }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="primary.main">Shipment · {s.shipmentId}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{s.origin} → {s.destPort}</Typography>
        <Typography variant="caption" color="text.secondary">
          {s.productName} · {s.customer} · {s.status} · ships {formatDate(s.date)} → ETA {formatDate(s.eta)}
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(3, 1fr)', mt: 1.5 }}>
          <Fact label="CO₂e" value={formatTonnes(s.co2eTonnes)} />
          <Fact label="Intensity" value={formatIntensity(s.co2ePerTonneKm)} />
          <Fact label="Mode" value={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><ModeIcon mode={s.primaryMode} fontSize="small" />{s.primaryMode}</Box>} />
          <Fact label="Weight" value={formatWeightTonnes(s.weightTonnes)} />
          <Fact label="Distance" value={formatDistance(s.totalDistanceKm)} />
          <Fact label="Freight" value={formatCurrency(s.freightUsd)} />
        </Box>
      </CardContent>
    </Card>
  );
}

const LEG_TABS: { key: keyof LaneDetail['scenarios']; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'best', label: 'Best for CO₂' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'optimal', label: 'Fastest' },
];

function DecisionPanel({ laneId, onAdopt, onOpen360, chosenKind, onChooseKind, readOnly = false }: { laneId: string; onAdopt: (m: string) => void; onOpen360: () => void; chosenKind: ScenarioKind; onChooseKind: (k: ScenarioKind) => void; readOnly?: boolean }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);

  if (status === 'loading' || !lane) return <TableSkeleton rows={6} />;

  const adopt = (s: Scenario, kind: ScenarioKind) => {
    onChooseKind(kind);
    dispatch(
      adoptDecision({
        laneId: lane.laneId,
        laneLabel: lane.label,
        approach: s.kind as ApproachKind,
        savingTonnes: Math.max(0, s.co2eDeltaTonnes) * lane.annualFrequency,
      }),
    );
    onAdopt(`Route locked · ${s.label} on ${lane.label} · ${Math.max(0, Math.round(s.co2eDeltaTonnes * lane.annualFrequency))} t/yr`);
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="overline" color="primary.main">Decisioning · {lane.customer}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {lane.origin} → {lane.destPort} · {lane.productCategory}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lane.shipmentCount} shipments · {lane.annualFrequency}/yr · LSP {lane.lsp}
              </Typography>
            </Box>
            <Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }} onClick={onOpen360}>
              Full 360 →
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: readOnly ? 'text.secondary' : 'primary.main', fontWeight: 600 }}>
            {readOnly
              ? 'Already shipped — the route taken is highlighted. Click any option to preview it on the map.'
              : 'Not booked yet — pick a route and the map updates live, then choose one to lock it in.'}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <ScenarioCompareChart scenarios={lane.scenarios} height={220} />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <ScenarioCard scenario={lane.scenarios.current} selected={chosenKind === 'current'} onClick={() => onChooseKind('current')} taken={readOnly} />
        <ScenarioCard scenario={lane.scenarios.best} selected={chosenKind === 'best'} onClick={() => onChooseKind('best')} recommended={lane.recommendedApproach === 'best_co2'} onAdopt={readOnly ? undefined : () => adopt(lane.scenarios.best, 'best')} actionLabel="Choose this route" />
        <ScenarioCard scenario={lane.scenarios.balanced} selected={chosenKind === 'balanced'} onClick={() => onChooseKind('balanced')} recommended={lane.recommendedApproach === 'balanced'} onAdopt={readOnly ? undefined : () => adopt(lane.scenarios.balanced, 'balanced')} actionLabel="Choose this route" />
        <ScenarioCard scenario={lane.scenarios.optimal} selected={chosenKind === 'optimal'} onClick={() => onChooseKind('optimal')} onAdopt={readOnly ? undefined : () => adopt(lane.scenarios.optimal, 'optimal')} actionLabel="Choose this route" />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Leg breakdown &amp; CO₂e calculation</Typography>
          <Tabs value={chosenKind} onChange={(_, v) => onChooseKind(v)} sx={{ mb: 1.5, minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}>
            {LEG_TABS.map((t) => (
              <Tab key={t.key} value={t.key} label={t.label} />
            ))}
          </Tabs>
          <LegTimeline legs={lane.scenarios[chosenKind].legs} />
        </CardContent>
      </Card>
    </Stack>
  );
}
