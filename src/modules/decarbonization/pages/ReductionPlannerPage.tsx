import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Snackbar, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScheduleBars } from '@/components/charts/ScheduleBars';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ApproachChip } from '@/components/shared/Chips';
import { RecommendationCard } from '@/modules/decarbonization/components/RecommendationCard';
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { dismissRecommendation, executeRecommendation, snoozeRecommendation } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { ActionType, ApproachKind, KpiMetric, Shipment } from '@/types';
import { formatTonnes, formatDate } from '@/utils/format';

const MODE_INTENT: Record<string, 'risk' | 'neutral'> = { Air: 'risk' };
const TYPE_FILTERS: { key: ActionType; label: string }[] = [
  { key: 'mode-shift', label: 'Mode shift' },
  { key: 'route-swap', label: 'Route' },
  { key: 'origin-port', label: 'Origin port' },
  { key: 'air-avoidance', label: 'Air avoidance' },
  { key: 'consolidation', label: 'Consolidation' },
  { key: 'lsp-swap', label: 'LSP swap' },
  { key: 'vendor-intervention', label: 'Vendor' },
];

export default function ReductionPlannerPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { executedRecIds, dismissedRecIds, snoozedRecIds } = useAppSelector((s) => s.actions);
  const { data: schedule, status: schedStatus } = useAsync(() => ds.getSchedule({ persona, filters }), [persona, filters]);
  const { data: recs, status: recStatus } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);

  const [activeTypes, setActiveTypes] = useState<Set<ActionType>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (t: ActionType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const openRecs = useMemo(() => (recs ?? []).filter((r) => !dismissedRecIds.includes(r.id)), [recs, dismissedRecIds]);
  const filtered = useMemo(
    () => openRecs.filter((r) => activeTypes.size === 0 || activeTypes.has(r.type)),
    [openRecs, activeTypes],
  );
  const backlogSaving = openRecs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const topRec = [...openRecs].sort((a, b) => b.estCo2eSavingTonnes - a.estCo2eSavingTonnes)[0];

  const kpis: KpiMetric[] | undefined = schedule && [
    { id: 'count', label: 'Planned shipments', value: schedule.plannedCount, unit: 'number', intent: 'neutral', icon: 'lanes', hint: `${schedule.window.from} → ${schedule.window.to}` },
    { id: 'co2e', label: 'Projected CO₂e', value: schedule.projectedCo2eTonnes, unit: 'tonnes', display: formatTonnes(schedule.projectedCo2eTonnes), intent: 'neutral', icon: 'co2e', hint: 'across the window' },
    { id: 'avoid', label: 'Avoidable by planning', value: schedule.avoidableTonnes, unit: 'tonnes', display: formatTonnes(schedule.avoidableTonnes), intent: 'opportunity', icon: 'savings', hint: 'lock the best route now' },
    { id: 'backlog', label: 'Reduction backlog', value: backlogSaving, unit: 'tonnes', display: `${formatTonnes(backlogSaving)}/yr`, intent: 'opportunity', icon: 'green', hint: `${openRecs.length} open actions` },
  ];

  const columns: Column<Shipment>[] = [
    { key: 'date', header: 'Ship date', render: (s) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(s.date)}</Typography>, sortValue: (s) => s.date },
    { key: 'eta', header: 'ETA', render: (s) => formatDate(s.eta), sortValue: (s) => s.eta },
    { key: 'lane', header: 'Lane', render: (s) => `${s.origin} → ${s.destPort}`, sortValue: (s) => s.origin },
    { key: 'product', header: 'Product', render: (s) => s.category, sortValue: (s) => s.category },
    { key: 'customer', header: 'Customer', render: (s) => s.customer, sortValue: (s) => s.customer },
    { key: 'mode', header: 'Mode', align: 'center', render: (s) => <Chip size="small" variant="outlined" color={MODE_INTENT[s.primaryMode] === 'risk' ? 'error' : 'default'} label={s.primaryMode} />, sortValue: (s) => s.primaryMode },
    { key: 'co2e', header: 'Proj. CO₂e', align: 'right', render: (s) => <strong>{formatTonnes(s.co2eTonnes)}</strong>, sortValue: (s) => s.co2eTonnes },
    { key: 'reduction', header: 'Avoidable', align: 'right', render: (s) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(s.avoidableTonnes)}</span>, sortValue: (s) => s.avoidableTonnes },
    { key: 'rec', header: 'Recommended', align: 'center', render: (s) => <ApproachChip kind={s.bestScenarioKind as ApproachKind} />, sortValue: (s) => s.bestScenarioKind },
  ];

  return (
    <Box>
      <PageHeader
        overline="Reduce · Planning & Reduction Engine"
        title="Reduction Planner"
        subtitle="Plan the forward book and act on the reduction backlog in one place — lock the lowest-carbon route before each shipment books, and work the ranked opportunities behind them."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
          </Box>
        ) : <KpiSkeleton count={4} />}
      </Box>

      {/* AI planner brief */}
      {schedule && topRec && (
        <Card sx={{ mb: 3, border: 1, borderColor: (t) => alpha(t.palette.primary.main, 0.35), background: (t) => `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${t.palette.background.paper} 60%)` }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <AutoAwesomeRounded sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Tradewind AI · planner brief</Typography>
              <Chip size="small" variant="outlined" color="primary" label="AI-generated" sx={{ ml: 'auto' }} />
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: '85ch' }}>
              Over the next <b>{schedule.plannedCount}</b> planned shipments (~{formatTonnes(schedule.projectedCo2eTonnes)} projected),
              about <b>{formatTonnes(schedule.avoidableTonnes)}</b> is avoidable by locking the best route now
              {schedule.airExposedCount > 0 && <> — <b>{schedule.airExposedCount}</b> are set to fly and should move to ocean/rail early</>}.
              The reduction backlog holds <b>{openRecs.length}</b> actions worth <b>{formatTonnes(backlogSaving)}/yr</b>. Highest-impact next move:
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
              <BoltRounded sx={{ fontSize: 18, color: 'secondary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{topRec.title}</Typography>
              <Chip size="small" color="success" variant="outlined" label={`${formatTonnes(topRec.estCo2eSavingTonnes)}/yr`} />
              <Button size="small" variant="contained" onClick={() => { dispatch(executeRecommendation(topRec)); setToast(`Executed · ${formatTonnes(topRec.estCo2eSavingTonnes)}/yr queued`); }} disabled={executedRecIds.includes(topRec.id)}>
                {executedRecIds.includes(topRec.id) ? 'Queued' : 'Execute'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Forward book */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Projected CO₂e by week"
          subtitle="The forward book, stacked by mode — watch the red (air) band and plan it down early"
          icon={<CalendarMonthRounded sx={{ fontSize: 18 }} />}
        >
          {schedule ? (
            schedule.byWeek.length ? <ScheduleBars data={schedule.byWeek} height={280} /> : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                No planned shipments in this window. Widen the date range to plan further out.
              </Typography>
            )
          ) : <ChartSkeleton height={280} />}
        </ChartContainer>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <EventRepeatRounded sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Planned shipments · {schedule?.plannedCount ?? 0}</Typography>
          </Stack>
          {schedStatus === 'loading' || !schedule ? (
            <TableSkeleton rows={6} />
          ) : (
            <DataTable columns={columns} rows={schedule.shipments} getRowKey={(s) => s.shipmentId} maxHeight={460} />
          )}
        </CardContent>
      </Card>

      {/* Reduction opportunity backlog */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <BoltRounded sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Reduction opportunities</Typography>
        <Typography variant="caption" color="text.secondary">ranked by CO₂e saving × confidence</Typography>
      </Stack>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mb: 2 }}>
        {TYPE_FILTERS.map((t) => (
          <Chip key={t.key} label={t.label} variant={activeTypes.has(t.key) ? 'filled' : 'outlined'} color={activeTypes.has(t.key) ? 'primary' : 'default'} onClick={() => toggle(t.key)} sx={{ cursor: 'pointer', fontWeight: 600 }} />
        ))}
      </Stack>
      <Stack spacing={1.5}>
        {recStatus === 'loading' && <TableSkeleton rows={5} />}
        {recStatus === 'success' && filtered.length === 0 && <EmptyState title="No open actions" description="No reduction actions match the current filters." />}
        {filtered.map((r) => (
          <RecommendationCard
            key={r.id}
            rec={r}
            executed={executedRecIds.includes(r.id)}
            snoozed={snoozedRecIds.includes(r.id)}
            onExecute={() => { dispatch(executeRecommendation(r)); setToast(`Executed · ${formatTonnes(r.estCo2eSavingTonnes)}/yr queued`); }}
            onSnooze={() => { dispatch(snoozeRecommendation(r)); setToast('Snoozed'); }}
            onDismiss={() => { dispatch(dismissRecommendation(r.id)); setToast('Dismissed'); }}
            onOpenLane={r.laneId ? () => dispatch(setSelectedLane(r.laneId!)) : undefined}
          />
        ))}
      </Stack>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
