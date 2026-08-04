import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { ChartContainer } from '@/components/charts/ChartContainer';
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
          `On the best routing the workbook itself records, that shipment would emit **${formatTonnes(lane.bestPerShipmentTonnes)}** instead — about **${cutPct}% less**. Across every shipment on this lane it is **${formatTonnes(lane.avoidableTonnes)}**, and the suggestion is **${lane.bestOptionLabel}**.`,
        );
      } else {
        out.push(
          `No cheaper routing appears here: every option the workbook records for these ports already costs at least what the current route does.`,
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
          description="Pick a shipment in the register on the left — or a route on the map — to compare its options: CO₂e, transit, distance and fuel, side by side, with the workbook cell behind each figure."
        />
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
              ? 'Every option the workbook records for this route — hover a leg for its distance, factor and source cell'
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
  // Open on the suggested option, so the map shows the change, not the status quo.
  const best = options?.find((o) => !o.isCurrent) ?? options?.[0];
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

  const best = s.options.find((o) => !o.isCurrent);
  const active = s.options.find((o) => o.id === optionId) ?? best ?? s.options[0];
  const isPast = s.status !== 'Planned';

  return (
    <Stack spacing={2}>
      <ShipmentFactsCard s={s} />
      <RouteOptions
        title={`Route options · ${s.destPort}`}
        subtitle={`${s.category} · ${s.reportingYear}`}
        note={
          isPast
            ? 'This shipment has already moved — the routing decision was made at booking. Below is the route as executed, with the alternatives the workbook shows were available.'
            : 'Still to be planned. Compare CO₂e, transit, distance and fuel; the suggested option is marked. Booking happens in your own systems.'
        }
        options={s.options}
        activeId={active?.id}
        onSelect={setOptionId}
        bestId={best?.id}
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
  const best = detail.options.find((o) => !o.isCurrent);
  const active = detail.options.find((o) => o.id === optionId) ?? best ?? detail.options[0];

  return (
    <RouteOptions
      title={`Route options · ${detail.destPort}`}
      subtitle={`${detail.shipmentCount} shipments · ${detail.annualFrequency}/yr · ${detail.category}`}
      note="Options for a representative shipment on this lane. Pick a specific shipment in the register for its own figures."
      options={detail.options}
      activeId={active?.id}
      onSelect={setOptionId}
      bestId={best?.id}
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
  bestId,
  takenId,
  onOpenLane,
}: {
  title: string;
  subtitle: string;
  note: string;
  options: RouteOption[];
  activeId?: string;
  onSelect: (id: string) => void;
  bestId?: string;
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
            <Typography
              variant="caption"
              color="primary.main"
              sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={onOpenLane}
            >
              Full lane 360 →
            </Typography>
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
            recommended={o.id === bestId}
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
        </Stack>
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
