import { useMemo, useState } from 'react';
import { Box, Chip, Snackbar, Stack } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { RecommendationCard } from '@/modules/decarbonization/components/RecommendationCard';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { dismissRecommendation, executeRecommendation, snoozeRecommendation } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { ActionType, KpiMetric } from '@/types';
import { formatTonnes } from '@/utils/format';

const TYPE_FILTERS: { key: ActionType; label: string }[] = [
  { key: 'mode-shift', label: 'Mode shift' },
  { key: 'route-swap', label: 'Route' },
  { key: 'origin-port', label: 'Origin port' },
  { key: 'air-avoidance', label: 'Air avoidance' },
  { key: 'consolidation', label: 'Consolidation' },
  { key: 'lsp-swap', label: 'LSP swap' },
  { key: 'vendor-intervention', label: 'Vendor' },
];

export default function RecommendationsPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { executedRecIds, dismissedRecIds, snoozedRecIds } = useAppSelector((s) => s.actions);
  const { data: recs, status } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);

  const [activeTypes, setActiveTypes] = useState<Set<ActionType>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (t: ActionType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const filtered = useMemo(
    () => (recs ?? []).filter((r) => !dismissedRecIds.includes(r.id) && (activeTypes.size === 0 || activeTypes.has(r.type))),
    [recs, activeTypes, dismissedRecIds],
  );

  const totalSaving = filtered.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const directCount = filtered.filter((r) => r.controllability.startsWith('Direct')).length;

  const kpis: KpiMetric[] = [
    { id: 'count', label: 'Open actions', value: filtered.length, unit: 'number', intent: 'neutral', hint: 'matching filters' },
    { id: 'saving', label: 'Total CO₂e saving', value: totalSaving, unit: 'tonnes', display: `${formatTonnes(totalSaving)}/yr`, intent: 'opportunity', hint: 'if all adopted' },
    { id: 'direct', label: 'Direct (Terova)', value: directCount, unit: 'number', intent: 'positive', hint: 'fully under control' },
    { id: 'influence', label: 'Partner influence', value: filtered.length - directCount, unit: 'number', intent: 'neutral', hint: 'via vendors & LSPs' },
  ];

  return (
    <Box>
      <PageHeader
        overline="Reduce · Reduction Engine"
        title="Reduction Opportunities"
        subtitle="Every reduction action across route, mode, port, consolidation, air avoidance and partner governance — ranked by CO₂e saving × confidence."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        {kpis.map((m) => (
          <KpiCard key={m.id} metric={m} />
        ))}
      </Box>

      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mb: 2.5 }}>
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            variant={activeTypes.has(t.key) ? 'filled' : 'outlined'}
            color={activeTypes.has(t.key) ? 'primary' : 'default'}
            onClick={() => toggle(t.key)}
            sx={{ cursor: 'pointer', fontWeight: 600 }}
          />
        ))}
      </Stack>

      <Stack spacing={1.5}>
        {status === 'loading' && <TableSkeleton rows={6} />}
        {status === 'success' && filtered.length === 0 && <EmptyState title="No recommendations" description="No actions match the current filters." />}
        {filtered.map((r) => (
          <RecommendationCard
            key={r.id}
            rec={r}
            executed={executedRecIds.includes(r.id)}
            snoozed={snoozedRecIds.includes(r.id)}
            onExecute={() => {
              dispatch(executeRecommendation(r));
              setToast(`Executed · ${formatTonnes(r.estCo2eSavingTonnes)}/yr queued`);
            }}
            onSnooze={() => {
              dispatch(snoozeRecommendation(r));
              setToast('Snoozed');
            }}
            onDismiss={() => {
              dispatch(dismissRecommendation(r.id));
              setToast('Dismissed');
            }}
            onOpenLane={r.laneId ? () => dispatch(setSelectedLane(r.laneId!)) : undefined}
          />
        ))}
      </Stack>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
