import { Box } from '@mui/material';
import type { CopilotView } from '@/types';
import { KpiCard } from '@/components/cards/KpiCard';
import { BarList } from '@/components/charts/BarList';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { LaneCard } from './LaneCard';
import { RecommendationCard } from './RecommendationCard';
import { formatTonnes } from '@/utils/format';

/** Renders whatever view the copilot chose to attach to its answer. */
export function CopilotViewRenderer({
  view,
  onOpenLane,
  onExecuteRec,
}: {
  view: CopilotView;
  onOpenLane?: (laneId: string) => void;
  onExecuteRec?: (recId: string) => void;
}) {
  if (view.kind === 'none') return null;

  if (view.kind === 'kpis' && view.kpis)
    return (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${Math.min(view.kpis.length, 4)}, 1fr)` } }}>
        {view.kpis.map((m) => (
          <KpiCard key={m.id} metric={m} />
        ))}
      </Box>
    );

  if (view.kind === 'hotspots' && view.hotspots)
    return (
      <ChartContainer title={view.title}>
        <BarList items={view.hotspots.map((h) => ({ label: h.label, value: h.co2eTonnes, sub: `${h.shipments} shipments` }))} valueFormatter={formatTonnes} />
      </ChartContainer>
    );

  if (view.kind === 'modeSplit' && view.modeSplit)
    return (
      <ChartContainer title={view.title}>
        <ModeSplitDonut data={view.modeSplit} />
      </ChartContainer>
    );

  if (view.kind === 'scenario' && view.scenarios)
    return (
      <ChartContainer title={view.title}>
        <ScenarioCompareChart scenarios={view.scenarios} />
      </ChartContainer>
    );

  if (view.kind === 'lanes' && view.lanes)
    return (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        {view.lanes.map((l) => (
          <LaneCard key={l.laneId} lane={l} onClick={onOpenLane ? () => onOpenLane(l.laneId) : undefined} />
        ))}
      </Box>
    );

  if (view.kind === 'recommendations' && view.recommendations)
    return (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {view.recommendations.map((r) => (
          <RecommendationCard
            key={r.id}
            rec={r}
            onExecute={onExecuteRec ? () => onExecuteRec(r.id) : undefined}
            onOpenLane={onOpenLane && r.laneId ? () => onOpenLane(r.laneId!) : undefined}
          />
        ))}
      </Box>
    );

  return null;
}
