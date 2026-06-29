import { useState } from 'react';
import { Box, Chip, Divider, Stack, Tab, Tabs, Typography } from '@mui/material';
import type { ApproachKind, LaneDetail, Scenario } from '@/types';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch } from '@/app/store/hooks';
import { adoptDecision, executeRecommendation } from '@/app/store/actionsSlice';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { WorldMap } from '@/components/map/WorldMap';
import { ScenarioCard } from './ScenarioCard';
import { LegTimeline } from './LegTimeline';
import { RecommendationCard } from './RecommendationCard';
import { formatTonnes } from '@/utils/format';

const SCEN_TABS: { key: keyof LaneDetail['scenarios']; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'best', label: 'Best for CO₂' },
  { key: 'optimal', label: 'Optimal' },
];

export function LaneDetailContent({ laneId, onToast }: { laneId: string; onToast: (m: string) => void }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);
  const [legTab, setLegTab] = useState<keyof LaneDetail['scenarios']>('current');

  if (status === 'loading') return <TableSkeleton rows={6} />;
  if (!lane) return <Typography color="text.secondary">Lane not found.</Typography>;

  const annualFreq = lane.annualFrequency;
  const adopt = (s: Scenario) => {
    dispatch(
      adoptDecision({
        laneId: lane.laneId,
        laneLabel: lane.label,
        approach: s.kind as ApproachKind,
        savingTonnes: Math.max(0, s.co2eDeltaTonnes) * annualFreq,
      }),
    );
    onToast(`Adopted ${s.label} on ${lane.label}`);
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">
          Lane 360 · Shipment route &amp; decisions
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {lane.origin} → {lane.destPort}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {lane.productCategory} · {lane.customer} ({lane.market}) · LSP {lane.lsp}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Metric label="Total CO₂e (lane)" value={formatTonnes(lane.totalCo2eTonnes)} />
        <Metric label="Realizable reduction" value={`${formatTonnes(lane.realizableReductionTonnes)}/yr`} accent />
        <Metric label="Shipments · annual trips" value={`${lane.shipmentCount} · ${lane.annualFrequency}/yr`} />
        <Metric label="Intensity" value={`${lane.avgCo2ePerTonne} t/t`} />
      </Box>

      <ChartContainer title="Map" subtitle="Inland → ocean → delivery legs">
        <WorldMap lanes={[lane]} selectedLaneId={lane.laneId} height={240} />
      </ChartContainer>

      <ChartContainer title="Decisioning" subtitle="CO₂e per shipment across the four approaches">
        <ScenarioCompareChart scenarios={lane.scenarios} />
      </ChartContainer>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <ScenarioCard scenario={lane.scenarios.current} />
        <ScenarioCard scenario={lane.scenarios.balanced} recommended={lane.recommendedApproach === 'balanced'} onAdopt={() => adopt(lane.scenarios.balanced)} />
        <ScenarioCard scenario={lane.scenarios.best} recommended={lane.recommendedApproach === 'best_co2'} onAdopt={() => adopt(lane.scenarios.best)} />
        <ScenarioCard scenario={lane.scenarios.optimal} onAdopt={() => adopt(lane.scenarios.optimal)} />
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Leg breakdown &amp; calculation
        </Typography>
        <Tabs value={legTab} onChange={(_, v) => setLegTab(v)} sx={{ mb: 1.5, minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}>
          {SCEN_TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>
        <LegTimeline legs={lane.scenarios[legTab].legs} />
      </Box>

      {lane.recommendations.length > 0 && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Reduction actions
            </Typography>
            <Chip size="small" label={`${lane.recommendations.length}`} />
          </Stack>
          <Stack spacing={1.5}>
            {lane.recommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                onExecute={() => {
                  dispatch(executeRecommendation(r));
                  onToast(`Action queued · ${r.title}`);
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: accent ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
