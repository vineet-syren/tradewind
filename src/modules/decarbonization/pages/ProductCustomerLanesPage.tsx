import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { ModeStackedBar } from '@/components/charts/ModeStackedBar';
import { ScatterBubbleChart, SwatchLegend, type BubblePoint } from '@/components/charts/ScatterBubbleChart';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { ApproachChip } from '@/components/shared/Chips';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import StackedBarChartRounded from '@mui/icons-material/StackedBarChartRounded';
import ScatterPlotRounded from '@mui/icons-material/ScatterPlotRounded';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import TableRowsRounded from '@mui/icons-material/TableRowsRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { KpiMetric, Lane } from '@/types';
import { formatTonnes, formatIntensity } from '@/utils/format';

export default function ProductCustomerLanesPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'co2e' }), [filters]);
  const { data: hotspots } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);

  const kpis: KpiMetric[] | undefined = footprint && hotspots && [
    { id: 'co2e', label: 'Annual CO₂e', value: footprint.annualCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(footprint.annualCo2eTonnes)}/yr`, intent: 'neutral', icon: 'co2e', hint: `${footprint.laneCount} lanes` },
    { id: 'cust', label: 'Top customer', value: 0, unit: 'number', display: formatTonnes(hotspots.byCustomer[0]?.co2eTonnes ?? 0), intent: 'risk', icon: 'customer', hint: hotspots.byCustomer[0]?.label ?? '—' },
    { id: 'prod', label: 'Top product', value: 0, unit: 'number', display: formatTonnes(hotspots.byProductCategory[0]?.co2eTonnes ?? 0), intent: 'risk', icon: 'product', hint: hotspots.byProductCategory[0]?.label ?? '—' },
    { id: 'conc', label: 'Top-5 customer share', value: footprint.top5CustomerSharePct, unit: 'percent', intent: footprint.top5CustomerSharePct > 50 ? 'risk' : 'neutral', icon: 'concentration', hint: 'of CO₂e' },
  ];

  // Air-exception lanes have ~100× the intensity of ocean lanes, so a raw linear
  // axis crushes every ocean lane against the left edge. Cap the axis at the 85th
  // percentile so the bulk of lanes spread out, and pin the air outliers to the
  // right edge — which is exactly where the "high-intensity, act-first" lanes belong.
  const plotted = (lanes ?? []).slice(0, 60);
  const sortedInt = plotted.map((l) => l.avgCo2ePerTonneKm).sort((a, b) => a - b);
  const pct = (p: number) => (sortedInt.length ? sortedInt[Math.min(sortedInt.length - 1, Math.floor(sortedInt.length * p))] : 0);
  const xCap = Math.max(1, Math.ceil(pct(0.85)));
  const medianIntensity = pct(0.5);
  const lanePoints: BubblePoint[] = plotted.map((l) => ({
    name: l.label,
    x: Math.min(l.avgCo2ePerTonneKm, xCap),
    y: l.totalCo2eTonnes,
    z: l.shipmentCount,
    color: l.hasAirExceptions ? theme.palette.error.main : theme.palette.primary.main,
    meta: `${l.customer} · ${formatTonnes(l.realizableReductionTonnes)}/yr realizable${l.avgCo2ePerTonneKm > xCap ? ' · off-scale intensity (air)' : ''}`,
  }));

  const columns: Column<Lane>[] = [
    { key: 'lane', header: 'Lane', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.origin} → {l.destPort}</Typography>, sortValue: (l) => l.origin },
    { key: 'product', header: 'Product', render: (l) => l.productCategory, sortValue: (l) => l.productCategory },
    { key: 'customer', header: 'Customer', render: (l) => l.customer, sortValue: (l) => l.customer },
    { key: 'ships', header: 'Shipments', align: 'right', render: (l) => l.shipmentCount, sortValue: (l) => l.shipmentCount },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.totalCo2eTonnes)}</strong>, sortValue: (l) => l.totalCo2eTonnes },
    { key: 'intensity', header: 'g/t·km', align: 'right', render: (l) => formatIntensity(l.avgCo2ePerTonneKm), sortValue: (l) => l.avgCo2ePerTonneKm },
    { key: 'reduction', header: 'Save/yr', align: 'right', render: (l) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(l.realizableReductionTonnes)}</span>, sortValue: (l) => l.realizableReductionTonnes },
    { key: 'approach', header: 'Recommended', align: 'center', render: (l) => <ApproachChip kind={l.recommendedApproach} />, sortValue: (l) => l.recommendedApproach },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Commercial + Supply Chain"
        title="Customer & Product Lanes"
        subtitle="Where emissions concentrate by customer and product, the mode mix behind each customer, and which lanes are both high-volume and high-intensity — the priorities for a reduction conversation."
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

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <ChartContainer title="CO₂e by customer" subtitle="Concentration — bigger tile, bigger footprint" icon={<StorefrontRounded sx={{ fontSize: 18 }} />}>
          {hotspots ? <TreemapChart data={hotspots.byCustomer.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
        <ChartContainer title="Customer mode mix" subtitle="CO₂e by mode — spot customers with air exposure" icon={<StackedBarChartRounded sx={{ fontSize: 18 }} />}>
          {hotspots ? <ModeStackedBar rows={hotspots.customerModeMatrix.map((r) => ({ name: r.customer, Ocean: r.Ocean, Rail: r.Rail, Road: r.Road, Air: r.Air }))} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, mb: 3 }}>
        <ChartContainer title="Lane priority" subtitle="CO₂e vs intensity · bubble = shipments · top-right = high volume & high intensity (act first)" icon={<ScatterPlotRounded sx={{ fontSize: 18 }} />}>
          {lanes ? (
            <>
              <ScatterBubbleChart points={lanePoints} xLabel="CO₂e per ton-km" yLabel="CO₂e" sizeLabel="Shipments" xFormat={formatIntensity} yFormat={formatTonnes} refX={medianIntensity} refXLabel="median" xDomain={[0, xCap]} height={300} />
              <SwatchLegend items={[{ color: theme.palette.primary.main, label: 'Ocean-led lane' }, { color: theme.palette.error.main, label: 'Has air exceptions' }]} />
            </>
          ) : <ChartSkeleton height={300} />}
        </ChartContainer>
        <ChartContainer title="CO₂e by product category" icon={<CategoryRounded sx={{ fontSize: 18 }} />}>
          {hotspots ? <TreemapChart data={hotspots.byProductCategory.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} height={300} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <TableRowsRounded sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              All lanes · {lanes?.length ?? 0}
            </Typography>
          </Stack>
          {status === 'loading' || !lanes ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable columns={columns} rows={lanes} getRowKey={(l) => l.laneId} onRowClick={(l) => dispatch(setSelectedLane(l.laneId))} initialSortKey="co2e" maxHeight={560} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
