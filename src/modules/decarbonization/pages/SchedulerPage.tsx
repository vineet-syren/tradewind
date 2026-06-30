import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScheduleBars } from '@/components/charts/ScheduleBars';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ApproachChip } from '@/components/shared/Chips';
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { ApproachKind, KpiMetric, Shipment } from '@/types';
import { formatTonnes, formatDate } from '@/utils/format';

const MODE_INTENT: Record<string, 'risk' | 'neutral'> = { Air: 'risk' };

export default function SchedulerPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: schedule, status } = useAsync(() => ds.getSchedule({ persona, filters }), [persona, filters]);

  const kpis: KpiMetric[] | undefined = schedule && [
    { id: 'count', label: 'Planned shipments', value: schedule.plannedCount, unit: 'number', intent: 'neutral', icon: 'lanes', hint: `${schedule.window.from} → ${schedule.window.to}` },
    { id: 'co2e', label: 'Projected CO₂e', value: schedule.projectedCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(schedule.projectedCo2eTonnes)}`, intent: 'neutral', icon: 'co2e', hint: 'across the window' },
    { id: 'avoid', label: 'Avoidable by planning', value: schedule.avoidableTonnes, unit: 'tonnes', display: `${formatTonnes(schedule.avoidableTonnes)}`, intent: 'opportunity', icon: 'savings', hint: 'switch to best route now' },
    { id: 'air', label: 'Air-exposed', value: schedule.airExposedCount, unit: 'number', intent: schedule.airExposedCount > 0 ? 'risk' : 'positive', icon: 'air', hint: 'plan onto ocean/rail early' },
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
        overline="Reduce · Forward Planning Agent"
        title="Shipment Planner"
        subtitle="The shipments still to move. Projected from recent lane cadence and the reduction trend, so you can lock the lowest-carbon route before each one books — not after it has flown."
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

      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Projected CO₂e by week"
          subtitle="The forward book, stacked by mode — watch the red (air) band and plan it down early"
          icon={<CalendarMonthRounded sx={{ fontSize: 18 }} />}
        >
          {schedule ? (
            schedule.byWeek.length ? <ScheduleBars data={schedule.byWeek} height={300} /> : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                No planned shipments in this window. Widen the date range to plan further out.
              </Typography>
            )
          ) : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <EventRepeatRounded sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Planned shipments · {schedule?.plannedCount ?? 0}
            </Typography>
          </Stack>
          {status === 'loading' || !schedule ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable columns={columns} rows={schedule.shipments} getRowKey={(s) => s.shipmentId} maxHeight={560} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
