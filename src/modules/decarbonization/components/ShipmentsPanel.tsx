import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, MenuItem, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { WorldMap } from '@/components/map/WorldMap';
import { SplitPane } from '@/components/layout/SplitPane';
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
import type { ApproachKind, LaneDetail, Scenario, Shipment } from '@/types';
import { formatTonnes, formatIntensity, formatDistance, formatCurrency, formatWeightTonnes, formatDate } from '@/utils/format';

const ROUTE_COUNTS = [5, 8, 12, 16];
type ScenarioKind = 'current' | 'best' | 'balanced' | 'optimal';

/** Shipments workspace: network map + full register (left) with the selected
 * shipment's route decisioning + 360 (right), split by a resizable divider. */
export function ShipmentsPanel() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'reduction' }), [filters]);

  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [chosenKind, setChosenKind] = useState<ScenarioKind>('current');
  const [toast, setToast] = useState<string | null>(null);
  const [routeCount, setRouteCount] = useState(8);
  const mapRef = useRef<HTMLDivElement>(null);

  const mapLanes = useMemo(() => lanes?.slice(0, routeCount) ?? [], [lanes, routeCount]);

  useEffect(() => {
    if (selectedLaneId && lanes && !lanes.find((l) => l.laneId === selectedLaneId)) {
      setSelectedLaneId(null);
      setSelectedShipment(null);
    }
  }, [lanes, selectedLaneId]);

  const selectShipment = (s: Shipment) => {
    setSelectedShipment(s);
    setSelectedLaneId(s.laneId);
    setChosenKind('current');
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const selectLaneFromMap = (laneId: string) => {
    setSelectedLaneId(laneId);
    setSelectedShipment(null);
    setChosenKind('current');
  };
  const activeLaneId = selectedShipment?.laneId ?? selectedLaneId;
  const isPast = Boolean(selectedShipment && selectedShipment.status !== 'Planned');

  const detail = selectedShipment ? (
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
  );

  return (
    <Box>
      <Box ref={mapRef}>
        <ChartContainer
          title="Outbound shipment network"
          subtitle={activeLaneId ? 'Tracing the selected shipment route' : `Showing the top ${mapLanes.length} of ${lanes?.length ?? 0} lanes · click one to trace its full route`}
          action={
            !activeLaneId && lanes ? (
              <TextField select size="small" label="Routes shown" value={routeCount} onChange={(e) => setRouteCount(Number(e.target.value))} sx={{ width: 150 }}>
                {ROUTE_COUNTS.map((n) => <MenuItem key={n} value={n}>Top {n} lanes</MenuItem>)}
              </TextField>
            ) : undefined
          }
        >
          {status === 'loading' ? <ChartSkeleton height={420} /> : <WorldMap lanes={mapLanes} selectedLaneId={activeLaneId} scenarioKind={chosenKind} onSelectLane={selectLaneFromMap} onClear={() => { setSelectedLaneId(null); setSelectedShipment(null); setChosenKind('current'); }} height={460} />}
        </ChartContainer>
      </Box>

      <Box sx={{ mt: 3 }}>
        <SplitPane
          left={<ShipmentLedgerSection compact onRowSelect={selectShipment} selectedId={selectedShipment?.shipmentId} />}
          right={<Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>{detail}</Box>}
        />
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
        <Typography variant="caption" color="text.secondary">{s.productName} · {s.customer} · {s.status} · ships {formatDate(s.date)} → ETA {formatDate(s.eta)}</Typography>
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
    dispatch(adoptDecision({ laneId: lane.laneId, laneLabel: lane.label, approach: s.kind as ApproachKind, savingTonnes: Math.max(0, s.co2eDeltaTonnes) * lane.annualFrequency }));
    onAdopt(`Route locked · ${s.label} on ${lane.label} · ${Math.max(0, Math.round(s.co2eDeltaTonnes * lane.annualFrequency))} t/yr`);
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="overline" color="primary.main">Decisioning · {lane.customer}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{lane.origin} → {lane.destPort} · {lane.productCategory}</Typography>
              <Typography variant="caption" color="text.secondary">{lane.shipmentCount} shipments · {lane.annualFrequency}/yr · LSP {lane.lsp}</Typography>
            </Box>
            <Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }} onClick={onOpen360}>Full 360 →</Typography>
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: readOnly ? 'text.secondary' : 'primary.main', fontWeight: 600 }}>
            {readOnly ? 'Already shipped — the route taken is highlighted. Click any option to preview it on the map.' : 'Not booked yet — pick a route and the map updates live, then choose one to lock it in.'}
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
            {LEG_TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
          </Tabs>
          <LegTimeline legs={lane.scenarios[chosenKind].legs} />
        </CardContent>
      </Card>
    </Stack>
  );
}
