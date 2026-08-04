import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Stack, Tab, Tabs, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ValueHero, type HeroPart } from '@/components/cards/ValueHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { WorldMap } from '@/components/map/WorldMap';
import { DecisionCard } from '@/modules/decarbonization/components/DecisionCard';
import { RouteOptionCard } from '@/modules/decarbonization/components/RouteOptionCard';
import { LegTimeline } from '@/modules/decarbonization/components/LegTimeline';
import { ShipmentRegister } from '@/modules/decarbonization/components/ShipmentRegister';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { TYPE_META } from '@/constants/actionTypes';
import { APP_TODAY } from '@/constants/app';
import { insightsForDecisions } from '@/utils/insights';
import { formatDate, formatTonnes, formatWeightTonnes } from '@/utils/format';
import type { Recommendation } from '@/types';

type View = 'open' | 'register';

/**
 * The logistics lead's landing page.
 *
 * It loads with no filter required and no click needed: the queue is ranked by
 * CO₂e saved, the top decision is pre-selected, and the map opens on its routes.
 * Everything needed to judge a decision is on its card — the map and leg
 * breakdown are there to confirm, not to discover.
 */
export default function DecisionsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const [view, setView] = useState<View>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: recs, status: recStatus } = useAsync(
    () => ds.getRecommendations({ persona, plannedOnly: true }),
    [persona],
  );
  // The forward book is small, so one page covers it; reaching past APP_TODAY is
  // what surfaces the planned rows the default window would otherwise hide.
  const { data: planned } = useAsync(
    () => ds.getShipments({ dateFrom: APP_TODAY, pageSize: 200, sortBy: 'date', sortDir: 'asc' }),
    [],
  );
  const { data: assumptions } = useAsync(() => ds.getAssumptions(), []);

  const shipmentsById = useMemo(
    () => new Map((planned?.items ?? []).map((s) => [s.shipmentId, s])),
    [planned],
  );

  const queue = useMemo(() => recs ?? [], [recs]);

  /**
   * A decision is a change, not a shipment: the same gateway swap usually applies
   * to several shipments, and listing it six times buries the point. Group by the
   * change itself (its type and its title, which names the gateway and ports) and
   * rank the groups by what they are worth together.
   */
  const groups = useMemo(() => {
    const byChange = new Map<string, Recommendation[]>();
    for (const r of queue) {
      const key = `${r.type}|${r.title}`;
      byChange.set(key, [...(byChange.get(key) ?? []), r]);
    }
    return [...byChange.values()]
      .map((recsInGroup) => [...recsInGroup].sort((a, b) => (a.shipmentDate ?? '').localeCompare(b.shipmentDate ?? '')))
      .sort(
        (a, b) =>
          b.reduce((s, r) => s + r.estCo2eSavingTonnes, 0) - a.reduce((s, r) => s + r.estCo2eSavingTonnes, 0),
      );
  }, [queue]);

  // Pre-select the top decision's first shipment so the map is never empty.
  useEffect(() => {
    if (!selectedId && groups.length) setSelectedId(groups[0][0].shipmentId ?? null);
  }, [groups, selectedId]);

  const hero = useMemo(() => {
    const byType = new Map<string, { tonnes: number; count: number }>();
    for (const r of queue) {
      const g = byType.get(r.type) ?? { tonnes: 0, count: 0 };
      g.tonnes += r.estCo2eSavingTonnes;
      g.count += 1;
      byType.set(r.type, g);
    }
    const parts: HeroPart[] = [...byType.entries()]
      .sort((a, b) => b[1].tonnes - a[1].tonnes)
      .map(([type, g]) => ({ label: TYPE_META[type]?.label ?? type, tonnes: g.tonnes, count: g.count }));
    return { total: queue.reduce((s, r) => s + r.estCo2eSavingTonnes, 0), parts };
  }, [queue]);

  return (
    <Box>
      <ValueHero
        totalTonnes={hero.total}
        decisionCount={queue.length}
        parts={hero.parts}
        asOf={assumptions ? formatDate(assumptions.asOf) : undefined}
      />

      <PageHeader
        overline="Decide · freight not yet booked"
        title="Decisions"
        subtitle="Ranked by the CO₂e each change saves. Every alternative is a route your transport workbook has already run, priced with its own distances and emission factors."
      />

      <Tabs value={view} onChange={(_, v: View) => setView(v)} sx={{ mb: 2.5, minHeight: 38, '& .MuiTab-root': { minHeight: 38 } }}>
        <Tab value="open" label={`Open decisions${queue.length ? ` (${queue.length})` : ''}`} />
        <Tab value="register" label="All shipments" />
      </Tabs>

      {view === 'register' ? (
        <ShipmentRegister />
      ) : recStatus === 'loading' ? (
        <Stack spacing={2}>
          <ChartSkeleton height={360} />
          <TableSkeleton rows={5} />
        </Stack>
      ) : !queue.length ? (
        <Card>
          <EmptyState
            icon={<CheckCircleRoundedIcon sx={{ fontSize: 44, color: 'success.main' }} />}
            title="Nothing is waiting on a decision"
            description="Every shipment in the forward book already uses the lowest-carbon route the workbook can evidence. Switch to All shipments to review what has already moved."
          />
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          {/* The queue — self-contained cards, no click needed to judge one */}
          <Stack spacing={2}>
            <ChartContainer
              title={`${groups.length} change${groups.length === 1 ? '' : 's'} to make`}
              subtitle={`Across ${queue.length} shipment${queue.length === 1 ? '' : 's'} · biggest saving first · click a shipment to trace it on the map`}
              insights={insightsForDecisions(queue)}
            >
              <Stack spacing={2}>
                {groups.map((group, i) => (
                  <DecisionCard
                    key={`${group[0].type}-${group[0].title}`}
                    recs={group}
                    rank={i + 1}
                    shipments={shipmentsById}
                    selectedShipmentId={selectedId}
                    onSelectShipment={setSelectedId}
                  />
                ))}
              </Stack>
            </ChartContainer>
          </Stack>

          {/* Confirmation pane — the routes on a map, then the arithmetic */}
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
            <SelectedDecisionPanel
              shipmentId={selectedId}
              rec={queue.find((r) => r.shipmentId === selectedId)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Map + option cards + leg maths for the selected decision. */
function SelectedDecisionPanel({ shipmentId, rec }: { shipmentId: string | null; rec?: Recommendation }) {
  const ds = useDataSource();
  const { data: detail, status } = useAsync(
    () => (shipmentId ? ds.getShipment(shipmentId) : Promise.resolve(null)),
    [shipmentId],
  );
  // Default to the suggested option so the map opens on the change, not the status quo.
  const [optionId, setOptionId] = useState<string | undefined>(undefined);
  useEffect(() => setOptionId(rec?.optionId), [rec?.optionId, shipmentId]);

  if (!shipmentId) {
    return (
      <Card sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
        <CardContent>
          <EmptyState title="Select a decision" description="Pick one on the left to see its routes on the map and the CO₂e maths leg by leg." />
        </CardContent>
      </Card>
    );
  }
  if (status === 'loading' || !detail) return <ChartSkeleton height={420} />;

  const active = detail.options.find((o) => o.id === optionId) ?? detail.options[0];
  const best = detail.options.find((o) => !o.isCurrent);

  return (
    <Stack spacing={2}>
      <ChartContainer
        title={`${detail.origin} → ${detail.destPort}`}
        subtitle={`${detail.productName} · ${formatWeightTonnes(detail.weightTonnes)} · ships ${formatDate(detail.date)}`}
      >
        <WorldMap options={detail.options} selectedOptionId={active?.id} onSelectOption={setOptionId} height={360} />
      </ChartContainer>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {detail.options.map((o) => (
          <RouteOptionCard
            key={o.id}
            option={o}
            selected={o.id === active?.id}
            recommended={!o.isCurrent && o.id === best?.id}
            onClick={() => setOptionId(o.id)}
          />
        ))}
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              How “{active?.label}” adds up
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {formatTonnes(active?.co2eTonnes ?? 0)}
            </Typography>
          </Stack>
          <LegTimeline legs={active?.legs ?? []} />
        </CardContent>
      </Card>
    </Stack>
  );
}
