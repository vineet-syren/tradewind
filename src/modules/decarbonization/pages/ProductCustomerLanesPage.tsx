import { useMemo, useState } from 'react';
import { Box, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { ModeStackedBar } from '@/components/charts/ModeStackedBar';
import { ScatterBubbleChart, SwatchLegend, type BubblePoint } from '@/components/charts/ScatterBubbleChart';
import { MekkoChart } from '@/components/charts/MekkoChart';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { ApproachChip } from '@/components/shared/Chips';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import StackedBarChartRounded from '@mui/icons-material/StackedBarChartRounded';
import ScatterPlotRounded from '@mui/icons-material/ScatterPlotRounded';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import TableRowsRounded from '@mui/icons-material/TableRowsRounded';
import ViewQuiltRounded from '@mui/icons-material/ViewQuiltRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScopePrompt } from '@/components/filters/ScopePrompt';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import { countActiveFilters } from '@/app/store/filtersSlice';
import type { KpiMetric, Lane } from '@/types';
import { APPROACH_LABEL } from '@/constants/app';
import { formatTonnes, formatIntensity } from '@/utils/format';
import { insightsForCustomerModes, insightsForHotspots, insightsForRegionModes } from '@/utils/insights';

export default function ProductCustomerLanesPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // No filters, no data pull — the page waits until the user scopes the view.
  const hasFilters = countActiveFilters(filters) > 0;
  const { data: lanes, status } = useAsync(() => (hasFilters ? ds.getLanes({ filters, sortBy: 'co2e' }) : Promise.resolve([])), [filters]);
  const { data: hotspots } = useAsync(() => (hasFilters ? ds.getHotspots({ persona, filters }) : Promise.resolve(null)), [persona, filters]);
  const { data: footprint } = useAsync(() => (hasFilters ? ds.getFootprint({ persona, filters }) : Promise.resolve(null)), [persona, filters]);

  const kpis: KpiMetric[] | undefined = !footprint || !hotspots ? undefined : [
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

  // Grounded findings for the bubble chart — computed from the same plotted lanes.
  const laneInsights = (() => {
    if (!plotted.length) return undefined;
    const top = [...plotted].sort((a, b) => b.totalCo2eTonnes - a.totalCo2eTonnes)[0];
    const airLanes = plotted.filter((l) => l.hasAirExceptions);
    const saving = plotted.reduce((s, l) => s + l.realizableReductionTonnes, 0);
    const out = [
      `${top.origin} → ${top.destPort} (${top.customer}) is the heaviest lane shown at ${formatTonnes(top.totalCo2eTonnes)} — its position vs the median line sets the priority.`,
      `${formatTonnes(saving)}/yr is realizable across the ${plotted.length} lanes plotted — the big bubbles right of the median move most of it.`,
    ];
    if (airLanes.length) out.push(`${airLanes.length} lanes carry air exceptions (red) — their intensity sits at or beyond the axis cap of ${formatIntensity(xCap)}.`);
    return out;
  })();

  // Local narrowing for the lane book — on top of the global filter bar.
  const [laneSearch, setLaneSearch] = useState('');
  const [recFilter, setRecFilter] = useState<string>('All');
  const filteredLanes = useMemo(() => {
    const q = laneSearch.trim().toLowerCase();
    return (lanes ?? []).filter(
      (l) =>
        (recFilter === 'All' || l.recommendedApproach === recFilter) &&
        (!q || [l.laneId, l.origin, l.destPort, l.customer, l.productCategory, l.market].join(' ').toLowerCase().includes(q)),
    );
  }, [lanes, laneSearch, recFilter]);

  const tableInsights = filteredLanes.length
    ? (() => {
        const totalSave = filteredLanes.reduce((s, l) => s + l.realizableReductionTonnes, 0);
        const top = [...filteredLanes].sort((a, b) => b.realizableReductionTonnes - a.realizableReductionTonnes)[0];
        const byRec = filteredLanes.reduce<Record<string, number>>((acc, l) => ((acc[l.recommendedApproach] = (acc[l.recommendedApproach] ?? 0) + 1), acc), {});
        const recLine = Object.entries(byRec)
          .sort((a, b) => b[1] - a[1])
          .map(([k, c]) => `${APPROACH_LABEL[k] ?? k} on ${c}`)
          .join(', ');
        const air = filteredLanes.filter((l) => l.hasAirExceptions).length;
        const out = [
          `${formatTonnes(totalSave)}/yr is realizable across the ${filteredLanes.length} lanes listed — the single biggest prize is ${top.origin} → ${top.destPort} (${top.customer}) at ${formatTonnes(top.realizableReductionTonnes)}/yr.`,
          `Recommended plays: ${recLine}. Sort by Save/yr and work top-down.`,
        ];
        if (air > 0) out.push(`${air} of these lanes carry air exceptions — they hold the largest per-shipment cuts.`);
        return out;
      })()
    : undefined;

  const columns: Column<Lane>[] = [
    {
      key: 'id',
      header: 'Lane ID',
      render: (l) => (
        <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {l.laneId}
        </Typography>
      ),
      sortValue: (l) => l.laneId,
    },
    { key: 'lane', header: 'Lane', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.origin} → {l.destPort}</Typography>, sortValue: (l) => l.origin },
    { key: 'product', header: 'Product', render: (l) => l.productCategory, sortValue: (l) => l.productCategory },
    { key: 'customer', header: 'Customer', render: (l) => l.customer, sortValue: (l) => l.customer },
    { key: 'ships', header: 'Shipments', align: 'right', render: (l) => l.shipmentCount, sortValue: (l) => l.shipmentCount },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.totalCo2eTonnes)}</strong>, sortValue: (l) => l.totalCo2eTonnes },
    { key: 'intensity', header: 'g/t·km', align: 'right', render: (l) => formatIntensity(l.avgCo2ePerTonneKm), sortValue: (l) => l.avgCo2ePerTonneKm },
    { key: 'reduction', header: 'Save/yr', align: 'right', render: (l) => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatTonnes(l.realizableReductionTonnes)}</span>, sortValue: (l) => l.realizableReductionTonnes },
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

      {!hasFilters ? (
        <Card>
          <EmptyState
            icon={<FilterAltRoundedIcon sx={{ fontSize: 44 }} />}
            title="Apply a filter to load lanes"
            description="Pick a period, region, market, product, mode or customer above — customer and product concentration, lane priorities and the lane book load once the view is scoped."
          />
          <ScopePrompt />
        </Card>
      ) : (
      <>
      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
          </Box>
        ) : <KpiSkeleton count={4} />}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <ChartContainer
          title="CO₂e by customer"
          subtitle="Concentration — bigger tile, bigger footprint"
          icon={<StorefrontRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForHotspots(hotspots.byCustomer, 'customer') : undefined}
        >
          {hotspots ? <TreemapChart data={hotspots.byCustomer.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
        <ChartContainer
          title="Customer mode mix"
          subtitle="CO₂e by mode — spot customers with air exposure"
          icon={<StackedBarChartRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForCustomerModes(hotspots.customerModeMatrix) : undefined}
        >
          {hotspots ? <ModeStackedBar rows={hotspots.customerModeMatrix.map((r) => ({ name: r.customer, Ocean: r.Ocean, Rail: r.Rail, Road: r.Road, Air: r.Air }))} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, mb: 3 }}>
        <ChartContainer
          title="Lane priority"
          subtitle="CO₂e vs intensity · bubble = shipments · top-right = high volume & high intensity (act first)"
          icon={<ScatterPlotRounded sx={{ fontSize: 18 }} />}
          insights={laneInsights}
        >
          {lanes ? (
            <>
              <ScatterBubbleChart points={lanePoints} xLabel="CO₂e per ton-km" yLabel="CO₂e" sizeLabel="Shipments" xFormat={formatIntensity} yFormat={formatTonnes} refX={medianIntensity} refXLabel="median" xDomain={[0, xCap]} height={300} />
              <SwatchLegend items={[{ color: theme.palette.primary.main, label: 'Ocean-led lane' }, { color: theme.palette.error.main, label: 'Has air exceptions' }]} />
            </>
          ) : <ChartSkeleton height={300} />}
        </ChartContainer>
        <ChartContainer
          title="CO₂e by product category"
          icon={<CategoryRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForHotspots(hotspots.byProductCategory, 'product category') : undefined}
        >
          {hotspots ? <TreemapChart data={hotspots.byProductCategory.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} height={300} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      {/* Market structure — mekko of region share × mode mix */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Market structure"
          subtitle={`Region share of CO₂e, stacked by transport mode — column width = region share${footprint ? ` of ${formatTonnes(footprint.totalCo2eTonnes)}` : ''}`}
          icon={<ViewQuiltRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForRegionModes(hotspots.regionModeMatrix) : undefined}
        >
          {hotspots ? <MekkoChart data={hotspots.regionModeMatrix} height={320} /> : <ChartSkeleton height={320} />}
        </ChartContainer>
      </Box>

      <ChartContainer
        title={`All lanes · ${filteredLanes.length}${lanes && filteredLanes.length !== lanes.length ? ` of ${lanes.length}` : ''}`}
        subtitle="Every corridor in scope — search, narrow by recommendation, click a row for the Lane 360"
        icon={<TableRowsRounded sx={{ fontSize: 18 }} />}
        insights={tableInsights}
        action={
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Search lanes" value={laneSearch} onChange={(e) => setLaneSearch(e.target.value)} sx={{ width: 190 }} />
            <TextField select size="small" label="Recommended" value={recFilter} onChange={(e) => setRecFilter(e.target.value)} sx={{ width: 160 }}>
              <MenuItem value="All">All</MenuItem>
              {Object.entries(APPROACH_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>
          </Stack>
        }
      >
        {status === 'loading' || !lanes ? (
          <TableSkeleton rows={8} />
        ) : filteredLanes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            No lanes match this search and recommendation filter.
          </Typography>
        ) : (
          <DataTable columns={columns} rows={filteredLanes} getRowKey={(l) => l.laneId} onRowClick={(l) => dispatch(setSelectedLane(l.laneId))} initialSortKey="co2e" maxHeight={560} />
        )}
      </ChartContainer>
      </>
      )}
    </Box>
  );
}
