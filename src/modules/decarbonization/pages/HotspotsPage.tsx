import { Box } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarList } from '@/components/charts/BarList';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { YearOverYearChart } from '@/components/charts/YearOverYearChart';
import { ReductionTrendChart } from '@/components/charts/ReductionTrendChart';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { MODE_COLORS } from '@/constants/app';
import type { HotspotRow, KpiMetric } from '@/types';
import { formatTonnes } from '@/utils/format';

const intensityFmt = (v: number) => `${v.toFixed(3)} t/t`;

export default function HotspotsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: hotspots, status } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);
  const { data: evidence } = useAsync(() => ds.getEvidence(), []);

  const toItems = (rows: HotspotRow[] = []) => rows.map((r) => ({ label: r.label, value: r.co2eTonnes, sub: `${r.shipments} shipments · ${r.co2ePerTonne} t/t` }));
  const toIntensity = (rows: HotspotRow[] = []) => [...rows].sort((a, b) => b.co2ePerTonne - a.co2ePerTonne).map((r) => ({ label: r.label, value: r.co2ePerTonne, sub: `${formatTonnes(r.co2eTonnes)} · ${r.shipments} shipments` }));

  const kpis: KpiMetric[] | undefined = footprint && [
    { id: 'co2e', label: 'Annual downstream CO₂e', value: footprint.annualCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(footprint.annualCo2eTonnes)}/yr`, intent: 'neutral', hint: `${footprint.shipmentCount} shipments` },
    { id: 'intensity', label: 'CO₂ per ton-km basis', value: footprint.avgIntensity, unit: 'intensity', intent: 'neutral', hint: 'the core efficiency metric' },
    { id: 'top5', label: 'Top-5 customer share', value: footprint.top5CustomerSharePct, unit: 'percent', intent: footprint.top5CustomerSharePct > 50 ? 'risk' : 'neutral', hint: 'concentration of CO₂e' },
    { id: 'air', label: 'Air CO₂e', value: footprint.airCo2eTonnes, unit: 'tonnes', display: formatTonnes(footprint.airCo2eTonnes), intent: 'risk', hint: `${footprint.airExceptionCount} air shipments` },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Footprint & Hotspot Agent"
        title="Emission Hotspots"
        subtitle="Where downstream-transport emissions concentrate and how they trend — by year, mode, carrier intensity, product, customer, lane and port. Act on the biggest first."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => (
              <KpiCard key={m.id} metric={m} />
            ))}
          </Box>
        ) : (
          <KpiSkeleton count={4} />
        )}
      </Box>

      {/* Trends — separate volume growth from efficiency (CO₂ per ton-km) */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 3 }}>
        <ChartContainer title="Year-over-year" subtitle="Total CO₂e (bars) vs CO₂ per-tonne intensity (line)">
          {footprint ? <YearOverYearChart data={footprint.byYear} /> : <ChartSkeleton height={260} />}
        </ChartContainer>
        <ChartContainer title="Monthly trend" subtitle="Net (after action) vs gross (pre-action); the gap is avoided emissions">
          {evidence ? <ReductionTrendChart data={evidence.monthly} height={260} /> : <ChartSkeleton height={260} />}
        </ChartContainer>
      </Box>

      {/* Mode split + intensity benchmarking */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' }, mb: 3 }}>
        {footprint && (
          <ChartContainer title="CO₂e by mode" subtitle="Share of emissions">
            <ModeSplitDonut data={footprint.modeSplit} />
          </ChartContainer>
        )}
        <ChartContainer title="CO₂ per ton-km by carrier" subtitle="Higher = less efficient · benchmark for carrier review">
          {hotspots ? <BarList items={toIntensity(hotspots.byLsp)} valueFormatter={intensityFmt} color="#9C6B3E" /> : <ChartSkeleton height={220} />}
        </ChartContainer>
        <ChartContainer title="CO₂ per ton-km by mode" subtitle="Air dwarfs ocean per tonne-km">
          {hotspots ? <BarList items={toIntensity(hotspots.byMode)} valueFormatter={intensityFmt} color="#1E6E8C" /> : <ChartSkeleton height={220} />}
        </ChartContainer>
      </Box>

      {footprint && (
        <Box sx={{ mb: 3 }}>
          <EquivalentsStrip tonnes={footprint.annualCo2eTonnes} title={`Annual footprint (${formatTonnes(footprint.annualCo2eTonnes)}/yr) in tangible terms`} />
        </Box>
      )}

      {/* Hotspot rankings */}
      {status === 'loading' || !hotspots ? (
        <ChartSkeleton height={360} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
          <ChartContainer title="By product category">
            <BarList items={toItems(hotspots.byProductCategory)} valueFormatter={formatTonnes} />
          </ChartContainer>
          <ChartContainer title="By customer">
            <BarList items={toItems(hotspots.byCustomer)} valueFormatter={formatTonnes} color="#1E6E8C" />
          </ChartContainer>
          <ChartContainer title="By destination market">
            <BarList items={toItems(hotspots.byMarket)} valueFormatter={formatTonnes} color="#7A5AA0" />
          </ChartContainer>
          <ChartContainer title="By destination port">
            <BarList items={toItems(hotspots.byDestPort)} valueFormatter={formatTonnes} color="#1E6E8C" />
          </ChartContainer>
          <ChartContainer title="By vendor / processor">
            <BarList items={toItems(hotspots.byVendor)} valueFormatter={formatTonnes} color="#3F8F7A" />
          </ChartContainer>
          <ChartContainer title="By origin region">
            <BarList items={toItems(hotspots.byOrigin)} valueFormatter={formatTonnes} color={MODE_COLORS.Road} />
          </ChartContainer>
        </Box>
      )}
    </Box>
  );
}
