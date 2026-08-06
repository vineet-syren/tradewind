import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, Chip, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { MetricHelp } from '@/components/charts/MetricHelp';
import { METRIC_GUIDE } from '@/constants/metricGuide';
import { OptionCompareChart } from '@/components/charts/OptionCompareChart';
import { WorldMap } from '@/components/map/WorldMap';
import { SplitPane } from '@/components/layout/SplitPane';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusChip } from '@/components/shared/Chips';
import { ScenarioCard } from '@/modules/decarbonization/components/ScenarioCard';
import { LegTimeline } from '@/modules/decarbonization/components/LegTimeline';
import { ShipmentLedgerSection } from '@/modules/decarbonization/components/ShipmentLedgerSection';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { Lane, RouteOption, Shipment, ShipmentDetail } from '@/types';
import { ORIGIN_COLOR, ORIGIN_LABEL } from '@/constants/app';
import { formatTonnes, formatIntensity, formatDistance, formatWeightTonnes, formatDate } from '@/utils/format';

const ROUTE_COUNTS = [5, 8, 12, 20];

/**
 * Shipments workspace: network map + full register (left) with the selected
 * shipment's route options and 360 (right), split by a resizable divider.
 *
 * Visibility and suggestions only — bookings happen in Terova's own systems.
 */
export function ShipmentsPanel() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'avoidable' }), [filters]);

  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [routeCount, setRouteCount] = useState(8);
  const mapRef = useRef<HTMLDivElement>(null);

  // Export lanes only on the map — collection runs are inland and would clutter it.
  const exportLanes = useMemo(() => (lanes ?? []).filter((l) => !l.laneId.startsWith('LN-COL-')), [lanes]);
  const mapLanes = useMemo(() => exportLanes.slice(0, routeCount), [exportLanes, routeCount]);

  // Grounded findings for the map. With a route selected the insight is about
  // THAT route; the network-wide summary shows only in the overview state.
  const networkInsights = useMemo(() => {
    if (!exportLanes.length) return undefined;
    const activeId = selectedShipment?.laneId ?? selectedLaneId;
    if (activeId) {
      const lane = exportLanes.find((l) => l.laneId === activeId);
      if (!lane) return undefined;
      const cut = lane.currentPerShipmentTonnes - lane.bestPerShipmentTonnes;
      const cutPct = lane.currentPerShipmentTonnes > 0 ? Math.round((cut / lane.currentPerShipmentTonnes) * 100) : 0;
      const out = [
        `This route runs from **${lane.origin}** (the factory) to **${lane.destPort}** (destination port) carrying **${lane.category}**. Today it leaves India through **${lane.primaryGateway}** and emits **${formatTonnes(lane.currentPerShipmentTonnes)}** on a representative shipment.`,
      ];
      if (cut > 0.0005) {
        out.push(
          `On the optimised route — **${lane.bestOptionLabel}**, a routing the workbook itself runs — that shipment would emit **${formatTonnes(lane.bestPerShipmentTonnes)}** instead, about **${cutPct}% less**. Across every shipment on this lane it is **${formatTonnes(lane.avoidableTonnes)}**.`,
        );
      } else {
        out.push(
          `This route is already the optimised one: every other routing the workbook records for these ports costs at least what it does.`,
        );
      }
      if (lane.hasAirFreight) {
        out.push(
          `**${lane.airShipmentCount} shipment${lane.airShipmentCount === 1 ? '' : 's'}** on this route flew, causing **${Math.round(lane.airSharePct)}%** of its CO₂e — air is charged at 188× the sea factor per tonne, so that is the first thing to review.`,
        );
      }
      return out;
    }
    const top = [...exportLanes].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes)[0];
    const saving = exportLanes.reduce((s, l) => s + l.avoidableTonnes, 0);
    const airLanes = exportLanes.filter((l) => l.hasAirFreight);
    const out = [
      `The biggest single opportunity is **${top.origin} → ${top.destPort}** carrying **${top.category}**: about **${formatTonnes(top.avoidableTonnes)}** could have gone a route the workbook already runs.`,
      `Across all **${exportLanes.length} lanes** in view that is roughly **${formatTonnes(saving)}**. Click any line to trace that route end to end.`,
    ];
    if (airLanes.length) {
      out.push(
        `**${airLanes.length} lane${airLanes.length === 1 ? '' : 's'}** carried freight by air — the workbook records sea routings to the same countries, so those are the quickest wins.`,
      );
    }
    return out;
  }, [exportLanes, selectedShipment, selectedLaneId]);

  useEffect(() => {
    if (selectedLaneId && lanes && !lanes.find((l) => l.laneId === selectedLaneId)) {
      setSelectedLaneId(null);
      setSelectedShipment(null);
    }
  }, [lanes, selectedLaneId]);

  const selectShipment = (s: Shipment) => {
    setSelectedShipment(s);
    setSelectedLaneId(s.laneId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const selectLaneFromMap = (laneId: string) => {
    setSelectedLaneId(laneId);
    setSelectedShipment(null);
  };
  const activeLaneId = selectedShipment?.laneId ?? selectedLaneId;

  const detail = selectedShipment ? (
    <ShipmentRoutePanel
      shipmentId={selectedShipment.shipmentId}
      onOpenLane={() => dispatch(setSelectedLane(selectedShipment.laneId))}
    />
  ) : selectedLaneId ? (
    <LaneRoutePanel lane={exportLanes.find((l) => l.laneId === selectedLaneId)} onOpenLane={() => dispatch(setSelectedLane(selectedLaneId))} />
  ) : (
    <Card sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
      <CardContent>
        <EmptyState
          title="Select a shipment"
          description="Pick a shipment in the register on the left — or a route on the map — to see its optimised route: CO₂e, transit, distance and fuel against every option the workbook evidences, with the source cell behind each figure."
        />
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box ref={mapRef}>
        <ChartContainer
          title="Outbound shipment network"
          guideKey="network-map"
          subtitle={
            activeLaneId
              ? 'The optimised route and every option it was chosen from — hover a leg for its distance, factor and source cell'
              : `Showing the top ${mapLanes.length} of ${exportLanes.length} lanes · click one to trace it end to end`
          }
          insights={networkInsights}
          action={
            !activeLaneId && lanes ? (
              <TextField
                select
                size="small"
                label="Routes shown"
                value={routeCount}
                onChange={(e) => setRouteCount(Number(e.target.value))}
                sx={{ width: 150 }}
              >
                {ROUTE_COUNTS.map((n) => (
                  <MenuItem key={n} value={n}>
                    Top {n} lanes
                  </MenuItem>
                ))}
              </TextField>
            ) : undefined
          }
        >
          {status === 'loading' ? (
            <ChartSkeleton height={420} />
          ) : (
            <NetworkMap
              lanes={mapLanes}
              activeLaneId={activeLaneId}
              shipmentId={selectedShipment?.shipmentId}
              onSelectLane={selectLaneFromMap}
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

/** Map that traces one shipment's options when selected, else the lane network. */
function NetworkMap({
  lanes,
  activeLaneId,
  shipmentId,
  onSelectLane,
}: {
  lanes: Lane[];
  activeLaneId?: string | null;
  shipmentId?: string;
  onSelectLane: (id: string) => void;
}) {
  const ds = useDataSource();
  const { data: shipment } = useAsync(
    () => (shipmentId ? ds.getShipment(shipmentId) : Promise.resolve(null)),
    [shipmentId],
  );
  const { data: lane } = useAsync(
    () => (!shipmentId && activeLaneId ? ds.getLane(activeLaneId) : Promise.resolve(null)),
    [activeLaneId, shipmentId],
  );
  const [optionId, setOptionId] = useState<string | undefined>(undefined);

  const options = shipment?.options ?? lane?.options;
  // Open on the optimised route, so the map shows the change, not the status quo.
  const best = options?.find((o) => o.isOptimised) ?? options?.[0];
  const active = options?.find((o) => o.id === optionId) ?? best;

  return (
    <WorldMap
      lanes={lanes}
      options={options}
      selectedOptionId={active?.id}
      onSelectOption={setOptionId}
      selectedLaneId={activeLaneId}
      onSelectLane={onSelectLane}
      height={460}
    />
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

function Place({ name, label }: { name: string; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap>
        {name}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/** Facts + route options + leg maths for one selected shipment. */
function ShipmentRoutePanel({ shipmentId, onOpenLane }: { shipmentId: string; onOpenLane: () => void }) {
  const ds = useDataSource();
  const { data: s, status } = useAsync(() => ds.getShipment(shipmentId), [shipmentId]);
  const [optionId, setOptionId] = useState<string | undefined>(undefined);
  useEffect(() => setOptionId(undefined), [shipmentId]);

  if (status === 'loading' || !s) return <TableSkeleton rows={6} />;

  const best = s.options.find((o) => o.isOptimised && !o.isCurrent);
  const active = s.options.find((o) => o.id === optionId) ?? best ?? s.options[0];
  const isPast = s.status !== 'Planned';
  const alts = s.alternativesConsidered;

  // Past and planned shipments get the same optimiser and the same cards; only
  // the tense changes — hindsight on what a booked route cost, a choice on what
  // an unbooked one will.
  const note = best
    ? isPast
      ? `This shipment has already moved, so the routing decision is history — but the optimised route below is one the workbook itself ran, and it would have saved ${formatTonnes(s.avoidableTonnes)} (${Math.round(s.avoidablePct)}%). Every option is priced on this shipment's own weight and distances.`
      : `Still to be planned — nothing here is booked yet. The optimised route below saves ${formatTonnes(s.avoidableTonnes)} (${Math.round(s.avoidablePct)}%) against the way this lane usually runs. Compare CO₂e, transit, distance and fuel; booking happens in your own systems.`
    : alts > 0
      ? `Already the optimised route. ${alts} other routing${alts === 1 ? '' : 's'} the workbook records ${alts === 1 ? 'was' : 'were'} priced on this shipment's own weight and distances, and ${alts === 1 ? 'it costs' : 'all cost'} more.`
      : 'The workbook records no other routing that reaches this destination, so there is nothing to compare against. Options are never invented.';

  return (
    <Stack spacing={2}>
      <ShipmentFactsCard s={s} />
      <RouteOptions
        title={`Route optimisation · ${s.destPort}`}
        subtitle={`${s.category} · ${s.reportingYear}`}
        note={note}
        options={s.options}
        activeId={active?.id}
        onSelect={setOptionId}
        takenId={isPast ? s.options.find((o) => o.isCurrent)?.id : undefined}
        onOpenLane={onOpenLane}
      />
    </Stack>
  );
}

/** Route options for a lane picked off the map (no single shipment selected). */
function LaneRoutePanel({ lane, onOpenLane }: { lane?: Lane; onOpenLane: () => void }) {
  const ds = useDataSource();
  const { data: detail, status } = useAsync(
    () => (lane ? ds.getLane(lane.laneId) : Promise.resolve(null)),
    [lane?.laneId],
  );
  const [optionId, setOptionId] = useState<string | undefined>(undefined);
  useEffect(() => setOptionId(undefined), [lane?.laneId]);

  if (status === 'loading' || !detail) return <TableSkeleton rows={6} />;
  const best = detail.options.find((o) => o.isOptimised && !o.isCurrent);
  const active = detail.options.find((o) => o.id === optionId) ?? best ?? detail.options[0];

  return (
    <RouteOptions
      title={`Route optimisation · ${detail.destPort}`}
      subtitle={`${detail.shipmentCount} shipments · ${detail.annualFrequency}/yr · ${detail.category}`}
      note={
        best
          ? `Optimised for a representative shipment on this lane — the one with the most at stake. Pick a specific shipment in the register for its own figures.`
          : `A representative shipment on this lane is already on its optimised route. Pick a specific shipment in the register for its own figures.`
      }
      options={detail.options}
      activeId={active?.id}
      onSelect={setOptionId}
      onOpenLane={onOpenLane}
    />
  );
}

/** The shared options block: compare chart, cards, and the leg breakdown. */
function RouteOptions({
  title,
  subtitle,
  note,
  options,
  activeId,
  onSelect,
  takenId,
  onOpenLane,
}: {
  title: string;
  subtitle: string;
  note: string;
  options: RouteOption[];
  activeId?: string;
  onSelect: (id: string) => void;
  takenId?: string;
  onOpenLane: () => void;
}) {
  const active = options.find((o) => o.id === activeId) ?? options[0];
  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="primary.main">
                {title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {subtitle}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <MetricHelp guide={METRIC_GUIDE['route-options']} />
              <Typography
                variant="caption"
                color="primary.main"
                sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={onOpenLane}
              >
                Full lane 360 →
              </Typography>
            </Stack>
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
            {note}
          </Typography>
          {options.length > 1 && (
            <Box sx={{ mt: 1 }}>
              <OptionCompareChart options={options} height={220} selectedOptionId={active?.id} onSelectOption={onSelect} />
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {options.map((o) => (
          <ScenarioCard
            key={o.id}
            option={o}
            selected={o.id === active?.id}
            taken={o.id === takenId}
            onClick={() => onSelect(o.id)}
          />
        ))}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Leg breakdown &amp; CO₂e calculation
          </Typography>
          {options.length > 1 ? (
            <Tabs
              value={active?.id ?? options[0].id}
              onChange={(_, v: string) => onSelect(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 1.5, minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}
            >
              {options.map((o) => (
                <Tab key={o.id} value={o.id} label={o.label} />
              ))}
            </Tabs>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Route as recorded
            </Typography>
          )}
          <LegTimeline legs={active?.legs ?? []} />
        </CardContent>
      </Card>
    </Stack>
  );
}

function ShipmentFactsCard({ s }: { s: ShipmentDetail }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }} useFlexGap>
          <Typography variant="overline" color="primary.main">
            Shipment · {s.shipmentId}
          </Typography>
          <StatusChip status={s.status} />
          <Chip
            size="small"
            variant="outlined"
            label={ORIGIN_LABEL[s.dataOrigin]}
            title={
              s.dataOrigin === 'synthetic'
                ? `The workbook is a closed record ending 30 Jun 2024, so the forward book is added on top of it. This is a real ${s.mirrorsReportingYear ?? 'workbook'} shipment with its dates rolled forward — product, weight, gateway, distances and factors are the recorded shipment's. It is not counted in the reported footprint or the ESG report.`
                : 'Read directly from Transport Downstream- V02.xlsx'
            }
            sx={{
              height: 20,
              fontSize: 10.5,
              fontWeight: 700,
              color: ORIGIN_COLOR[s.dataOrigin],
              borderColor: alpha(ORIGIN_COLOR[s.dataOrigin], 0.45),
              bgcolor: alpha(ORIGIN_COLOR[s.dataOrigin], 0.07),
            }}
          />
        </Stack>
        {s.dataOrigin === 'synthetic' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Forward book — the workbook is a closed record ending 30 Jun 2024, so this is a real{' '}
            {s.mirrorsReportingYear ?? 'workbook'} shipment with its dates rolled forward into the planning window.
            Every distance and factor below is the recorded shipment's, and it is not counted in the reported footprint.
          </Typography>
        )}
        {/* Endpoints labelled Source / Destination so the arrow reads clearly */}
        <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mt: 0.25, mb: 1.5 }}>
          <Place name={s.origin} label="Source" />
          <ArrowForwardRounded sx={{ fontSize: 20, color: 'text.secondary', mt: 0.4, flexShrink: 0 }} />
          <Place name={s.destPort} label={`Destination · ${s.destCountry}`} />
        </Stack>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Fact label="Product" value={s.productName} />
          <Fact label="Category" value={s.category} />
          <Fact label="Market" value={s.market} />
          <Fact label="Ship date" value={formatDate(s.date)} />
          <Fact label="ETA (est.)" value={formatDate(s.eta)} />
          <Fact
            label="Mode"
            value={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <ModeIcon mode={s.primaryMode} fontSize="small" />
                {s.primaryMode}
              </Box>
            }
          />
          <Fact label="CO₂e" value={formatTonnes(s.co2eTonnes)} />
          <Fact label="Intensity" value={formatIntensity(s.co2ePerTonneKm)} />
          <Fact label="Weight" value={formatWeightTonnes(s.weightTonnes)} />
          <Fact label="Distance" value={formatDistance(s.totalDistanceKm)} />
          <Fact label="Gateway" value={s.gateway ?? 'Flown out'} />
          <Fact label="Depot" value={s.icd ?? '—'} />
          <Fact label="Container" value={s.containerType ?? '—'} />
          <Fact label="Scoville" value={s.shu ? `${s.shu.toLocaleString('en-US')} SHU` : '—'} />
          <Fact label="Reporting year" value={s.reportingYear} />
        </Box>
      </CardContent>
    </Card>
  );
}
