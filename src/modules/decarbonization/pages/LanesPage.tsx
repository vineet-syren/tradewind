import { useEffect, useMemo, useState } from 'react';
import { Box, Card, MenuItem, Stack, TextField } from '@mui/material';
import RouteRounded from '@mui/icons-material/RouteRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ChartSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { WorldMap } from '@/components/map/WorldMap';
import { LaneCard, type LaneRankKey } from '@/modules/decarbonization/components/LaneCard';
import { LaneDetailContent } from '@/modules/decarbonization/components/LaneDetailContent';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { formatTonnes } from '@/utils/format';

const RANKS: { key: LaneRankKey; label: string }[] = [
  { key: 'avoidable', label: 'Most avoidable CO₂e' },
  { key: 'co2e', label: 'Largest footprint' },
  { key: 'shipments', label: 'Most shipments' },
  { key: 'intensity', label: 'Least efficient' },
];

/**
 * Lanes = destination port × product category. The map shows the network, the
 * list ranks it, and selecting one opens everything about it beside the map —
 * no drawer, no second page.
 */
export default function LanesPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ persona, filters }), [persona, filters]);
  const [rankBy, setRankBy] = useState<LaneRankKey>('avoidable');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Export lanes only on the map — collection runs are inland and would clutter it.
  const exportLanes = useMemo(() => (lanes ?? []).filter((l) => !l.laneId.startsWith('LN-COL-')), [lanes]);

  const ranked = useMemo(() => {
    const key: Record<LaneRankKey, (l: (typeof exportLanes)[number]) => number> = {
      avoidable: (l) => l.avoidableTonnes,
      co2e: (l) => l.totalCo2eTonnes,
      shipments: (l) => l.shipmentCount,
      intensity: (l) => l.avgCo2ePerTonneKm,
    };
    return [...exportLanes].sort((a, b) => key[rankBy](b) - key[rankBy](a));
  }, [exportLanes, rankBy]);

  // Open on the top-ranked lane so the page is useful before any click.
  useEffect(() => {
    if (ranked.length && (!selectedId || !ranked.some((l) => l.laneId === selectedId))) {
      setSelectedId(ranked[0].laneId);
    }
  }, [ranked, selectedId]);

  const totalAvoidable = ranked.reduce((s, l) => s + l.avoidableTonnes, 0);

  return (
    <Box>
      <PageHeader
        overline="Understand · corridors"
        title="Lanes"
        subtitle="Every destination port × product category the workbook records, ranked by what is still recoverable on routes it has already run."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {status === 'loading' || !lanes ? (
        <ChartSkeleton height={420} />
      ) : !ranked.length ? (
        <Card>
          <EmptyState
            icon={<RouteRounded sx={{ fontSize: 44 }} />}
            title="No lanes in scope"
            description="No lane matches the current filters. Clear one to bring the network back."
          />
        </Card>
      ) : (
        <Stack spacing={3}>
          <ChartContainer
            title="Outbound network"
            subtitle={`${ranked.length} lanes · ${formatTonnes(totalAvoidable)} avoidable in total · click a line to open that lane`}
            icon={<RouteRounded sx={{ fontSize: 18 }} />}
          >
            <WorldMap lanes={ranked} selectedLaneId={selectedId} onSelectLane={setSelectedId} height={400} />
          </ChartContainer>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 380px) minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
            <ChartContainer
              title="Lanes"
              subtitle="Select one to see its options"
              action={
                <TextField select size="small" label="Rank by" value={rankBy} onChange={(e) => setRankBy(e.target.value as LaneRankKey)} sx={{ width: 186 }}>
                  {RANKS.map((r) => (
                    <MenuItem key={r.key} value={r.key}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
              }
            >
              <Stack spacing={1.5} sx={{ maxHeight: 720, overflowY: 'auto', pr: 0.5 }}>
                {ranked.map((lane) => (
                  <LaneCard
                    key={lane.laneId}
                    lane={lane}
                    rankBy={rankBy}
                    selected={lane.laneId === selectedId}
                    onClick={() => setSelectedId(lane.laneId)}
                  />
                ))}
              </Stack>
            </ChartContainer>

            <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <Card sx={{ p: { xs: 2, md: 2.5 } }}>
                {selectedId ? (
                  <LaneDetailContent laneId={selectedId} />
                ) : (
                  <EmptyState title="Select a lane" description="Pick a lane on the left, or a line on the map." />
                )}
              </Card>
            </Box>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
