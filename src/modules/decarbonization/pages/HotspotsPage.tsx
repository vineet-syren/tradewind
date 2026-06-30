import { useState } from 'react';
import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarList } from '@/components/charts/BarList';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { YearOverYearChart } from '@/components/charts/YearOverYearChart';
import { ModeTrendArea } from '@/components/charts/ModeTrendArea';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { HotspotDimension, KpiMetric } from '@/types';
import { formatTonnes } from '@/utils/format';

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
const intensityFmt = (v: number) => `${v.toFixed(3)} t/t`;

export default function HotspotsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: hotspots } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);

  const [dimension, setDimension] = useState<HotspotDimension>('byCustomer');
  const rows = hotspots ? hotspots[dimension] : [];

  // YoY deltas from the two most recent complete years (drop the partial current
  // year so a half-year of data doesn't read as a huge drop).
  const years = footprint?.byYear ?? [];
  const fullYears = years.length >= 3 ? years.slice(0, -1) : years;
  const latestY = fullYears[fullYears.length - 1];
  const priorY = fullYears[fullYears.length - 2];
  const yoyLabel = latestY && priorY ? `${latestY.year} vs ${priorY.year}` : undefined;
  const pctChange = (cur?: number, prev?: number) => (prev ? ((cur! - prev) / prev) * 100 : undefined);

  const kpis: KpiMetric[] | undefined = footprint && [
    { id: 'co2e', label: 'Annual downstream CO₂e', value: footprint.annualCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(footprint.annualCo2eTonnes)}/yr`, intent: 'neutral', icon: 'co2e', deltaPct: pctChange(latestY?.co2eTonnes, priorY?.co2eTonnes), deltaLabel: yoyLabel, betterWhenLower: true, hint: `${footprint.shipmentCount} shipments` },
    { id: 'intensity', label: 'CO₂ per ton-km', value: footprint.avgIntensity, unit: 'intensity', intent: 'neutral', icon: 'intensity', deltaPct: pctChange(latestY?.intensity, priorY?.intensity), deltaLabel: yoyLabel, betterWhenLower: true, hint: 'the core efficiency metric' },
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

      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
          </Box>
        ) : <KpiSkeleton count={4} />}
      </Box>

      {/* Trends */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <ChartContainer title="Year-over-year" subtitle="Total CO₂e (bars) vs CO₂ per-tonne intensity (line)" icon={<ShowChartRounded sx={{ fontSize: 18 }} />}>
          {footprint ? <YearOverYearChart data={footprint.byYear} /> : <ChartSkeleton height={260} />}
        </ChartContainer>
        <ChartContainer title="Emissions by mode over time" subtitle="Stacked monthly CO₂e — watch the air band" icon={<LayersRounded sx={{ fontSize: 18 }} />}>
          {hotspots ? <ModeTrendArea data={hotspots.monthlyByMode} /> : <ChartSkeleton height={260} />}
        </ChartContainer>
      </Box>

      {/* Self-service explorer */}
      <ChartContainer
        title="Explore emissions by dimension"
        subtitle="Pick a lens — see where CO₂e concentrates and which are least efficient (CO₂ per ton-km)"
        icon={<TravelExploreRounded sx={{ fontSize: 18 }} />}
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
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CO₂ per ton-km (least efficient first)</Typography>
            <Box sx={{ mt: 1.5 }}>
              {hotspots ? (
                <BarList items={[...rows].sort((a, b) => b.co2ePerTonne - a.co2ePerTonne).map((r) => ({ label: r.label, value: r.co2ePerTonne, sub: `${formatTonnes(r.co2eTonnes)} · ${r.shipments} shipments` }))} valueFormatter={intensityFmt} color="#9C6B3E" />
              ) : <ChartSkeleton height={260} />}
            </Box>
          </Box>
        </Box>
      </ChartContainer>

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
    </Box>
  );
}
