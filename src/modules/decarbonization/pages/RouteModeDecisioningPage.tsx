import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material';
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
import type { ApproachKind, LaneDetail, Scenario } from '@/types';

const MAP_LANE_COUNT = 28;

export default function RouteModeDecisioningPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'reduction' }), [filters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const mapLanes = useMemo(() => lanes?.slice(0, MAP_LANE_COUNT) ?? [], [lanes]);
  const listLanes = useMemo(() => lanes?.slice(0, 16) ?? [], [lanes]);

  // Clear the selection only if it falls out of the filtered set — default to
  // the grouped "all routes" view so the user sees every shipment lane first.
  useEffect(() => {
    if (selectedId && lanes && !lanes.find((l) => l.laneId === selectedId)) setSelectedId(null);
  }, [lanes, selectedId]);

  return (
    <Box>
      <PageHeader
        overline="Visibility · End-to-end routes"
        title="Shipment Route Map"
        subtitle="Trace every shipment end to end — route, mode, CO₂e, distance and fuel. Select a lane to isolate its route and compare the Optimal, Balanced and Best-for-CO₂ options."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <ChartContainer
        title="Outbound shipment network"
        subtitle={selectedId ? 'Tracing the selected shipment route' : `${mapLanes.length} shipment lanes · click one to trace its full route`}
      >
        {status === 'loading' ? (
          <ChartSkeleton height={420} />
        ) : (
          <WorldMap lanes={mapLanes} selectedLaneId={selectedId} onSelectLane={setSelectedId} onClear={() => setSelectedId(null)} height={460} />
        )}
      </ChartContainer>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1.55fr' }, mt: 3 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Lanes by reduction potential
          </Typography>
          {status === 'loading' ? (
            <TableSkeleton rows={6} />
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 720, overflowY: 'auto', pr: 0.5 }}>
              {listLanes.map((l) => (
                <Box key={l.laneId} sx={{ outline: l.laneId === selectedId ? '2px solid' : 'none', outlineColor: 'primary.main', borderRadius: 4 }}>
                  <LaneCard lane={l} onClick={() => setSelectedId(l.laneId)} />
                </Box>
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
                <EmptyState title="Select a lane" description="Pick a lane on the map or list to compare its Optimal, Balanced and Best-for-CO₂ paths." />
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
