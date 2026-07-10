import { useMemo, useState } from 'react';
import { Box, Card, Chip, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { IntensityRanking } from '@/components/charts/IntensityRanking';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { YearOverYearChart } from '@/components/charts/YearOverYearChart';
import { MoMTrendChart } from '@/components/charts/MoMTrendChart';
import { ModeTrendArea } from '@/components/charts/ModeTrendArea';
import { SankeyChart } from '@/components/charts/SankeyChart';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded';
import GridOnRounded from '@mui/icons-material/GridOnRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScopePrompt } from '@/components/filters/ScopePrompt';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { countActiveFilters } from '@/app/store/filtersSlice';
import type { HotspotDimension, KpiMetric } from '@/types';
import { formatPeriod, formatTonnes } from '@/utils/format';
import {
  insightsForFlows,
  insightsForHotspots,
  insightsForMonthlyByMode,
  insightsForSeasonality,
  insightsForMonthOverMonth,
  insightsForYearOverYear,
} from '@/utils/insights';

const DIMENSIONS: { key: HotspotDimension; label: string }[] = [
  { key: 'byCustomer', label: 'Customer' },
  { key: 'byProductCategory', label: 'Product category' },
  { key: 'byMarket', label: 'Destination market' },
  { key: 'byDestPort', label: 'Destination port' },
  { key: 'byOriginPort', label: 'Origin gateway' },
  { key: 'byLsp', label: 'Carrier' },
  { key: 'byVendor', label: 'Vendor / processor' },
  { key: 'byOrigin', label: 'Origin region' },
];
export default function HotspotsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // No filters, no data pull — the page waits until the user scopes the view.
  const hasFilters = countActiveFilters(filters) > 0;
  const { data: hotspots } = useAsync(() => (hasFilters ? ds.getHotspots({ persona, filters }) : Promise.resolve(null)), [persona, filters]);
  const { data: footprint } = useAsync(() => (hasFilters ? ds.getFootprint({ persona, filters }) : Promise.resolve(null)), [persona, filters]);

  const [dimension, setDimension] = useState<HotspotDimension>('byCustomer');
  const [trendView, setTrendView] = useState<'yoy' | 'mom'>('yoy');
  // Clicking a YoY bar drills into that year's months.
  const [momYear, setMomYear] = useState<number | null>(null);
  // Month-over-month rows: total CO₂e per month (all transport modes summed).
  // With a drilled year, exactly that year's months; otherwise the last 18.
  const momRows = useMemo(() => {
    const all = hotspots?.monthlyByMode ?? [];
    const scoped = momYear ? all.filter((m) => m.period.startsWith(String(momYear))) : all.slice(-18);
    return scoped.map((m) => ({ label: formatPeriod(m.period), value: m.Ocean + m.Rail + m.Road + m.Air }));
  }, [hotspots, momYear]);
  const drillIntoYear = (year: number) => {
    setMomYear(year);
    setTrendView('mom');
  };
  const rows = hotspots ? hotspots[dimension] : [];
  const dimensionLabel = DIMENSIONS.find((d) => d.key === dimension)?.label ?? 'dimension';

  // Mode × month matrix (last 12 periods) for the seasonality heat map.
  const heatmap = useMemo(() => {
    const months = (hotspots?.monthlyByMode ?? []).slice(-12);
    const modes = ['Ocean', 'Rail', 'Road', 'Air'] as const;
    return {
      rows: modes as unknown as string[],
      cols: months.map((m) => formatPeriod(m.period)),
      values: modes.map((mode) => months.map((m) => m[mode])),
    };
  }, [hotspots]);

  // Progress vs the 2020 baseline (robust, and the reduction journey the program
  // is measured against). Compare the latest complete year to the baseline year.
  const years = footprint?.byYear ?? [];
  const latestY = years.length >= 2 ? years[years.length - 2] : years[years.length - 1]; // skip partial current year
  const baseY = years[0];
  const baseLabel = latestY && baseY && latestY.year !== baseY.year ? `vs ${baseY.year} baseline` : undefined;
  const pctChange = (cur?: number, prev?: number) => (prev ? ((cur! - prev) / prev) * 100 : undefined);

  const kpis: KpiMetric[] | undefined = !footprint ? undefined : [
    { id: 'co2e', label: 'Annual downstream CO₂e', value: footprint.annualCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(footprint.annualCo2eTonnes)}/yr`, intent: 'neutral', icon: 'co2e', hint: `${footprint.shipmentCount} shipments` },
    { id: 'intensity', label: 'CO₂ per ton-km', value: footprint.avgIntensity, unit: 'intensity', intent: 'neutral', icon: 'intensity', deltaPct: pctChange(latestY?.intensity, baseY?.intensity), deltaLabel: baseLabel, betterWhenLower: true, hint: 'the core efficiency metric' },
    { id: 'top5', label: 'Top-5 customer share', value: footprint.top5CustomerSharePct, unit: 'percent', intent: footprint.top5CustomerSharePct > 50 ? 'risk' : 'neutral', icon: 'concentration', hint: 'concentration of CO₂e' },
    { id: 'air', label: 'Air CO₂e', value: footprint.airCo2eTonnes, unit: 'tonnes', display: formatTonnes(footprint.airCo2eTonnes), intent: 'risk', icon: 'air', hint: `${footprint.airExceptionCount} air shipments` },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Footprint & Hotspot Agent"
        title="Emission Hotspots"
        subtitle="Trend, concentration and intensity in one view. Track year-over-year, see the mode mix over time, then explore any dimension — customer, product, carrier, port — for CO₂e and CO₂ per ton-km."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {!hasFilters ? (
        <Card>
          <EmptyState
            icon={<FilterAltRoundedIcon sx={{ fontSize: 44 }} />}
            title="Apply a filter to load hotspots"
            description="Pick a period, region, market, product, mode or customer above — trends, flows and the hotspot explorer load once the view is scoped."
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

      {/* Trends */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <ChartContainer
          title={trendView === 'yoy' ? 'Year-over-year' : momYear ? `Month-over-month · ${momYear}` : 'Month-over-month'}
          subtitle={
            trendView === 'yoy' ? 'Total CO₂e (bars) vs intensity (line) · click a year for its months' : undefined
          }
          icon={<ShowChartRounded sx={{ fontSize: 18 }} />}
          insights={trendView === 'yoy' ? (footprint ? insightsForYearOverYear(footprint.byYear) : undefined) : momRows.length ? insightsForMonthOverMonth(momRows) : undefined}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              {trendView === 'mom' && momYear && (
                <Chip size="small" color="primary" variant="outlined" label={`Months of ${momYear}`} onDelete={() => setMomYear(null)} />
              )}
              <ToggleButtonGroup size="small" exclusive value={trendView} onChange={(_, v) => v && setTrendView(v)} sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1.25, textTransform: 'none', fontWeight: 600 } }}>
                <ToggleButton value="yoy">YoY</ToggleButton>
                <ToggleButton value="mom">MoM</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          }
        >
          {trendView === 'yoy' ? (
            footprint ? <YearOverYearChart data={footprint.byYear} onYearClick={drillIntoYear} /> : <ChartSkeleton height={260} />
          ) : momRows.length ? (
            <MoMTrendChart data={momRows} />
          ) : (
            <ChartSkeleton height={260} />
          )}
        </ChartContainer>
        <ChartContainer
          title="Emissions by mode over time"
          subtitle="Stacked monthly CO₂e — watch the air band"
          icon={<LayersRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForMonthlyByMode(hotspots.monthlyByMode) : undefined}
        >
          {hotspots ? <ModeTrendArea data={hotspots.monthlyByMode} /> : <ChartSkeleton height={260} />}
        </ChartContainer>
      </Box>

      {/* Self-service explorer */}
      <ChartContainer
        title="Explore emissions by dimension"
        subtitle="Pick a lens — see where CO₂e concentrates and which are least efficient (CO₂ per ton-km)"
        icon={<TravelExploreRounded sx={{ fontSize: 18 }} />}
        insights={hotspots ? insightsForHotspots(rows, dimensionLabel.toLowerCase()) : undefined}
        action={
          <TextField select size="small" label="View by" value={dimension} onChange={(e) => setDimension(e.target.value as HotspotDimension)} sx={{ width: 190 }}>
            {DIMENSIONS.map((d) => (
              <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>
            ))}
          </TextField>
        }
      >
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' } }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CO₂e share</Typography>
            {hotspots ? <TreemapChart data={rows.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} height={300} /> : <ChartSkeleton height={300} />}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CO₂e per tonne-km · least efficient first</Typography>
            <Box sx={{ mt: 1.5 }}>
              {hotspots ? (
                <IntensityRanking
                  items={[...rows].sort((a, b) => b.co2ePerTonneKm - a.co2ePerTonneKm).map((r) => ({ label: r.label, value: r.co2ePerTonneKm, sub: `${formatTonnes(r.co2eTonnes)} · ${r.shipments} shipments` }))}
                  avg={footprint?.avgIntensity}
                />
              ) : <ChartSkeleton height={260} />}
            </Box>
          </Box>
        </Box>
      </ChartContainer>

      {/* Flow structure & seasonality */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' }, mt: 3 }}>
        <ChartContainer
          title="Emission flows"
          subtitle="Origin → mode → destination market · follow the CO₂e through the network"
          icon={<AccountTreeRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForFlows(hotspots.flows) : undefined}
        >
          {hotspots ? <SankeyChart flows={hotspots.flows} height={380} /> : <ChartSkeleton height={380} />}
        </ChartContainer>
        <ChartContainer
          title="Seasonality heat map"
          subtitle="CO₂e by mode × month — darker cell, heavier month"
          icon={<GridOnRounded sx={{ fontSize: 18 }} />}
          insights={hotspots ? insightsForSeasonality(hotspots.monthlyByMode) : undefined}
        >
          {hotspots ? (
            <HeatmapChart rows={heatmap.rows} cols={heatmap.cols} values={heatmap.values} fitHeight={380} valueFormatter={(v) => formatTonnes(v, 0)} />
          ) : (
            <ChartSkeleton height={220} />
          )}
        </ChartContainer>
      </Box>

      {footprint && (
        <Box sx={{ mt: 3 }}>
          <EquivalentsStrip tonnes={footprint.annualCo2eTonnes} title={`Annual footprint (${formatTonnes(footprint.annualCo2eTonnes)}/yr) in tangible terms`} />
        </Box>
      )}

      {hotspots && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Tip: combine with the filter bar above to drill into a region, market or year.
          </Typography>
        </Stack>
      )}
      </>
      )}
    </Box>
  );
}
