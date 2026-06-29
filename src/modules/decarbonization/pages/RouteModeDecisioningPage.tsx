import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, MenuItem, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { WorldMap } from '@/components/map/WorldMap';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { LaneCard } from '@/modules/decarbonization/components/LaneCard';
import { ScenarioCard } from '@/modules/decarbonization/components/ScenarioCard';
import { LegTimeline } from '@/modules/decarbonization/components/LegTimeline';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { adoptDecision } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { ApproachKind, Lane, LaneDetail, Scenario } from '@/types';

const ROUTE_COUNTS = [5, 8, 12, 16];
type ListSortKey = 'reduction' | 'co2e' | 'shipments' | 'pct';
const LIST_SORTS: { key: ListSortKey; label: string; value: (l: Lane) => number }[] = [
  { key: 'reduction', label: 'Reduction potential', value: (l) => l.realizableReductionTonnes },
  { key: 'co2e', label: 'Total CO₂e', value: (l) => l.totalCo2eTonnes },
  { key: 'shipments', label: 'Shipment volume', value: (l) => l.shipmentCount },
  { key: 'pct', label: 'Reduction %', value: (l) => l.reductionPotentialPct },
];

export default function RouteModeDecisioningPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'reduction' }), [filters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [routeCount, setRouteCount] = useState(8);
  const [listSort, setListSort] = useState<ListSortKey>('reduction');

  // Top N most-impactful lanes on the map (kept small so it reads cleanly).
  const mapLanes = useMemo(() => lanes?.slice(0, routeCount) ?? [], [lanes, routeCount]);
  const listLanes = useMemo(() => {
    const fn = LIST_SORTS.find((s) => s.key === listSort)!.value;
    return [...(lanes ?? [])].sort((a, b) => fn(b) - fn(a)).slice(0, 24);
  }, [lanes, listSort]);

  // Clear the selection only if it falls out of the filtered set — default to
  // the grouped view so the user sees the top shipment lanes first.
  useEffect(() => {
    if (selectedId && lanes && !lanes.find((l) => l.laneId === selectedId)) setSelectedId(null);
  }, [lanes, selectedId]);

  return (
    <Box>
      <PageHeader
        overline="Visibility · End-to-end routes"
        title="Shipment Route Map"
        subtitle="Trace every shipment end to end — route, mode, CO₂e, distance and fuel. Select a lane to isolate its route and compare the Fastest, Balanced and Best-for-CO₂ options."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <ChartContainer
        title="Outbound shipment network"
        subtitle={
          selectedId
            ? 'Tracing the selected shipment route'
            : `Showing the top ${mapLanes.length} of ${lanes?.length ?? 0} lanes · click one to trace its full route`
        }
        action={
          !selectedId && lanes ? (
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
          <WorldMap lanes={mapLanes} selectedLaneId={selectedId} onSelectLane={setSelectedId} onClear={() => setSelectedId(null)} height={460} />
        )}
      </ChartContainer>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1.55fr' }, mt: 3 }}>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Lanes ranked
            </Typography>
            <TextField
              select
              size="small"
              label="Sort by"
              value={listSort}
              onChange={(e) => setListSort(e.target.value as ListSortKey)}
              sx={{ width: 180 }}
            >
              {LIST_SORTS.map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {status === 'loading' ? (
            <TableSkeleton rows={6} />
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 760, overflowY: 'auto', px: 0.5, py: 0.5 }}>
              {listLanes.map((l) => (
                <LaneCard key={l.laneId} lane={l} selected={l.laneId === selectedId} onClick={() => setSelectedId(l.laneId)} />
              ))}
            </Stack>
          )}
        </Box>

        <Box>
          {selectedId ? (
            <DecisionPanel laneId={selectedId} onAdopt={(m) => setToast(m)} onOpen360={() => dispatch(setSelectedLane(selectedId))} />
          ) : (
            <Card>
              <CardContent>
                <EmptyState title="Select a lane" description="Pick a lane on the map or the ranked list to compare its Fastest, Balanced and Best-for-CO₂ paths." />
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

const LEG_TABS: { key: keyof LaneDetail['scenarios']; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'best', label: 'Best for CO₂' },
  { key: 'optimal', label: 'Optimal' },
];

function DecisionPanel({ laneId, onAdopt, onOpen360 }: { laneId: string; onAdopt: (m: string) => void; onOpen360: () => void }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);
  const [legTab, setLegTab] = useState<keyof LaneDetail['scenarios']>('best');

  if (status === 'loading' || !lane) return <TableSkeleton rows={6} />;

  const adopt = (s: Scenario) => {
    dispatch(
      adoptDecision({
        laneId: lane.laneId,
        laneLabel: lane.label,
        approach: s.kind as ApproachKind,
        savingTonnes: Math.max(0, s.co2eDeltaTonnes) * lane.annualFrequency,
      }),
    );
    onAdopt(`Adopted ${s.label} on ${lane.label} · ${Math.max(0, Math.round(s.co2eDeltaTonnes * lane.annualFrequency))} t/yr`);
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="overline" color="primary.main">
                Decisioning · {lane.customer}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {lane.origin} → {lane.destPort} · {lane.productCategory}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lane.shipmentCount} shipments · {lane.annualFrequency}/yr · LSP {lane.lsp}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              color="primary.main"
              sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={onOpen360}
            >
              Full 360 →
            </Typography>
          </Stack>
          <Box sx={{ mt: 1 }}>
            <ScenarioCompareChart scenarios={lane.scenarios} height={220} />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <ScenarioCard scenario={lane.scenarios.current} />
        <ScenarioCard scenario={lane.scenarios.balanced} recommended={lane.recommendedApproach === 'balanced'} onAdopt={() => adopt(lane.scenarios.balanced)} />
        <ScenarioCard scenario={lane.scenarios.best} recommended={lane.recommendedApproach === 'best_co2'} onAdopt={() => adopt(lane.scenarios.best)} />
        <ScenarioCard scenario={lane.scenarios.optimal} onAdopt={() => adopt(lane.scenarios.optimal)} />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Leg breakdown &amp; CO₂e calculation
          </Typography>
          <Tabs value={legTab} onChange={(_, v) => setLegTab(v)} sx={{ mb: 1.5, minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}>
            {LEG_TABS.map((t) => (
              <Tab key={t.key} value={t.key} label={t.label} />
            ))}
          </Tabs>
          <LegTimeline legs={lane.scenarios[legTab].legs} />
        </CardContent>
      </Card>
    </Stack>
  );
}
