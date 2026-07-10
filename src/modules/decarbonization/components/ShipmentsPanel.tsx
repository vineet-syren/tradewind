import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
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
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { LaneDetail, Shipment } from '@/types';
import { APPROACH_LABEL } from '@/constants/app';
import { formatTonnes, formatIntensity, formatDistance, formatCurrency, formatWeightTonnes, formatDate } from '@/utils/format';

const ROUTE_COUNTS = [5, 8, 12, 16];
type ScenarioKind = 'current' | 'best' | 'balanced' | 'optimal';

/** Shipments workspace: network map + full register (left) with the selected
 * shipment's route options + 360 (right), split by a resizable divider.
 * Visibility and suggestions only — bookings happen in the customer's own systems. */
export function ShipmentsPanel() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'reduction' }), [filters]);

  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [chosenKind, setChosenKind] = useState<ScenarioKind>('current');
  const [routeCount, setRouteCount] = useState(8);
  const mapRef = useRef<HTMLDivElement>(null);

  const mapLanes = useMemo(() => lanes?.slice(0, routeCount) ?? [], [lanes, routeCount]);
  // All four options are drawn only for a shipment that is still to be planned —
  // for shipped freight the route is history, so only the route taken is traced.
  const compareRoutes = Boolean(selectedShipment && selectedShipment.status === 'Planned');

  // Grounded findings for the map. When a route is selected the insight is about
  // THAT route only; the network-wide summary shows only in the overview state.
  const networkInsights = useMemo(() => {
    if (!lanes?.length) return undefined;
    const activeId = selectedShipment?.laneId ?? selectedLaneId;
    if (activeId) {
      const lane = lanes.find((l) => l.laneId === activeId);
      if (!lane) return undefined;
      const cut = lane.currentPerShipmentTonnes - lane.bestPerShipmentTonnes;
      const cutPct = lane.currentPerShipmentTonnes > 0 ? Math.round((cut / lane.currentPerShipmentTonnes) * 100) : 0;
      const out = [
        `This route runs from **${lane.origin}** (origin city in India) to **${lane.destPort}** (destination port) for **${lane.customer}** (the customer). Today it moves mainly by ${lane.primaryMode.toLowerCase()} and emits **${formatTonnes(lane.currentPerShipmentTonnes)}** of CO₂e per shipment.`,
        `If future shipments used the greenest option, each would emit **${formatTonnes(lane.bestPerShipmentTonnes)}** instead — about **${cutPct}% less**. Across a year that is **${formatTonnes(lane.realizableReductionTonnes)}** avoidable. Our suggestion for this route: **${APPROACH_LABEL[lane.recommendedApproach]}**.`,
      ];
      if (lane.hasAirExceptions)
        out.push(
          `**${lane.airShipmentCount} shipment${lane.airShipmentCount === 1 ? '' : 's'}** on this route went by air (plane), which causes **${Math.round(lane.airSharePct)}%** of the route's CO₂e — reviewing why they flew is the quickest win here.`,
        );
      return out;
    }
    const top = [...lanes].sort((a, b) => b.realizableReductionTonnes - a.realizableReductionTonnes)[0];
    const saving = lanes.reduce((s, l) => s + l.realizableReductionTonnes, 0);
    const airLanes = lanes.filter((l) => l.hasAirExceptions);
    const out = [
      `The biggest single opportunity is the route **${top.origin} → ${top.destPort}** serving **${top.customer}** (customer): about **${formatTonnes(top.realizableReductionTonnes)} per year** could be avoided by greener routing.`,
      `Adding up every route shown, roughly **${formatTonnes(saving)} per year** is avoidable across **${lanes.length} routes**. Click any line on the map to see that route's options in detail.`,
    ];
    if (airLanes.length)
      out.push(
        `**${airLanes.length} routes** have shipments that went by air (plane) — air freight emits far more CO₂e per tonne than sea or rail, so those are the first routes worth reviewing.`,
      );
    return out;
  }, [lanes, selectedShipment, selectedLaneId]);

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
      <RouteOptionsPanel laneId={selectedShipment.laneId} chosenKind={chosenKind} onChooseKind={setChosenKind} readOnly={isPast} onOpen360={() => dispatch(setSelectedLane({ laneId: selectedShipment.laneId, readOnly: isPast }))} />
    </Stack>
  ) : selectedLaneId ? (
    <RouteOptionsPanel laneId={selectedLaneId} chosenKind={chosenKind} onChooseKind={setChosenKind} readOnly={false} onOpen360={() => dispatch(setSelectedLane(selectedLaneId))} />
  ) : (
    <Card sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
      <CardContent>
        <EmptyState title="Select a shipment" description="Pick a shipment in the register on the left — or a route on the map — to compare its route options: CO₂e, cost, timeline, distance and fuel, side by side." />
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box ref={mapRef}>
        <ChartContainer
          title="Outbound shipment network"
          subtitle={
            activeLaneId
              ? compareRoutes
                ? 'All four route options for the selected shipment — hover a line to compare, click to highlight'
                : 'Tracing the selected shipment route'
              : `Showing the top ${mapLanes.length} of ${lanes?.length ?? 0} routes · click one to trace it end to end`
          }
          insights={networkInsights}
          action={
            !activeLaneId && lanes ? (
              <TextField select size="small" label="Routes shown" value={routeCount} onChange={(e) => setRouteCount(Number(e.target.value))} sx={{ width: 150 }}>
                {ROUTE_COUNTS.map((n) => <MenuItem key={n} value={n}>Top {n} lanes</MenuItem>)}
              </TextField>
            ) : undefined
          }
        >
          {status === 'loading' ? (
            <ChartSkeleton height={420} />
          ) : (
            <WorldMap
              lanes={mapLanes}
              selectedLaneId={activeLaneId}
              scenarioKind={chosenKind}
              showAllRoutes={compareRoutes}
              onSelectKind={(k) => setChosenKind(k)}
              onSelectLane={selectLaneFromMap}
              onClear={() => { setSelectedLaneId(null); setSelectedShipment(null); setChosenKind('current'); }}
              height={460}
            />
          )}
        </ChartContainer>
      </Box>

      <Box sx={{ mt: 3 }}>
        <SplitPane
          left={<ShipmentLedgerSection compact onRowSelect={selectShipment} selectedId={selectedShipment?.shipmentId} />}
          right={<Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>{detail}</Box>}
        />
      </Box>
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, display: 'block' }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

function Place({ name, label }: { name: string; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap>
        {name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function ShipmentFactsCard({ s }: { s: Shipment }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="primary.main">Shipment · {s.shipmentId}</Typography>
        {/* Route endpoints are labelled Source / Destination so the arrow reads clearly */}
        <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mt: 0.25, mb: 1.5 }}>
          <Place name={s.origin} label="Source" />
          <ArrowForwardRounded sx={{ fontSize: 20, color: 'text.secondary', mt: 0.4, flexShrink: 0 }} />
          <Place name={s.destPort} label="Destination" />
        </Stack>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Fact label="Product" value={s.productName} />
          <Fact label="Customer" value={s.customer} />
          <Fact label="Market" value={s.market} />
          <Fact label="Ship date" value={formatDate(s.date)} />
          <Fact label="ETA" value={formatDate(s.eta)} />
          <Fact label="Mode" value={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><ModeIcon mode={s.primaryMode} fontSize="small" />{s.primaryMode}</Box>} />
          <Fact label="CO₂e" value={formatTonnes(s.co2eTonnes)} />
          <Fact label="Intensity" value={formatIntensity(s.co2ePerTonneKm)} />
          <Fact label="Freight cost" value={formatCurrency(s.freightUsd)} />
          <Fact label="Weight" value={formatWeightTonnes(s.weightTonnes)} />
          <Fact label="Distance" value={formatDistance(s.totalDistanceKm)} />
          <Box />
          <Fact label="Vendor (prepares goods)" value={s.vendor} />
          <Fact label="LSP (books freight)" value={s.lsp} />
          <Fact label="Carrier (moves freight)" value={s.carrier} />
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

/** Route options for one shipment/route — pure comparison, no booking action. */
function RouteOptionsPanel({ laneId, onOpen360, chosenKind, onChooseKind, readOnly = false }: { laneId: string; onOpen360: () => void; chosenKind: ScenarioKind; onChooseKind: (k: ScenarioKind) => void; readOnly?: boolean }) {
  const ds = useDataSource();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);

  if (status === 'loading' || !lane) return <TableSkeleton rows={6} />;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="overline" color="primary.main">Route options · {lane.customer}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{lane.origin} → {lane.destPort} · {lane.productCategory}</Typography>
              <Typography variant="caption" color="text.secondary">{lane.shipmentCount} shipments · {lane.annualFrequency}/yr · vendor {lane.vendor} · LSP {lane.lsp}</Typography>
            </Box>
            <Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }} onClick={onOpen360}>Full 360 →</Typography>
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: readOnly ? 'text.secondary' : 'primary.main', fontWeight: 600 }}>
            {readOnly
              ? 'This shipment is already underway or delivered — the route decision was made at booking. Below is the route as executed.'
              : 'To be planned — the map traces all four options. Compare CO₂e, cost, timeline, distance and fuel; the suggested option is marked. Booking happens in your own systems.'}
          </Typography>
          {!readOnly && (
            <Box sx={{ mt: 1 }}>
              <ScenarioCompareChart scenarios={lane.scenarios} height={220} />
            </Box>
          )}
        </CardContent>
      </Card>

      {readOnly ? (
        /* Decision already made — show only the option taken, no alternatives. */
        <ScenarioCard scenario={lane.scenarios.current} taken />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <ScenarioCard scenario={lane.scenarios.current} selected={chosenKind === 'current'} onClick={() => onChooseKind('current')} />
          <ScenarioCard scenario={lane.scenarios.best} selected={chosenKind === 'best'} onClick={() => onChooseKind('best')} recommended={lane.recommendedApproach === 'best_co2'} />
          <ScenarioCard scenario={lane.scenarios.balanced} selected={chosenKind === 'balanced'} onClick={() => onChooseKind('balanced')} recommended={lane.recommendedApproach === 'balanced'} />
          <ScenarioCard scenario={lane.scenarios.optimal} selected={chosenKind === 'optimal'} onClick={() => onChooseKind('optimal')} />
        </Box>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Leg breakdown &amp; CO₂e calculation</Typography>
          {readOnly ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Route taken</Typography>
          ) : (
            <Tabs value={chosenKind} onChange={(_, v) => onChooseKind(v)} sx={{ mb: 1.5, minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}>
              {LEG_TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
            </Tabs>
          )}
          <LegTimeline legs={lane.scenarios[readOnly ? 'current' : chosenKind].legs} />
        </CardContent>
      </Card>
    </Stack>
  );
}
