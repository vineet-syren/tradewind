import { Box } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarList } from '@/components/charts/BarList';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { MODE_COLORS } from '@/constants/app';
import type { HotspotRow, KpiMetric } from '@/types';
import { formatTonnes } from '@/utils/format';

export default function HotspotsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: hotspots, status } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);

  const toItems = (rows: HotspotRow[] = []) => rows.map((r) => ({ label: r.label, value: r.co2eTonnes, sub: `${r.shipments} shipments · ${r.co2ePerTonne} t/t` }));

  const kpis: KpiMetric[] | undefined = footprint && [
    { id: 'co2e', label: 'Annual downstream CO₂e', value: footprint.annualCo2eTonnes, unit: 'tonnes', display: `${formatTonnes(footprint.annualCo2eTonnes)}/yr`, intent: 'neutral', hint: `${footprint.shipmentCount} shipments` },
    { id: 'intensity', label: 'Avg intensity', value: footprint.avgIntensity, unit: 'intensity', intent: 'neutral', hint: 't CO₂e per tonne shipped' },
    { id: 'top5', label: 'Top-5 customer share', value: footprint.top5CustomerSharePct, unit: 'percent', intent: footprint.top5CustomerSharePct > 50 ? 'risk' : 'neutral', hint: 'concentration of CO₂e' },
    { id: 'air', label: 'Air CO₂e', value: footprint.airCo2eTonnes, unit: 'tonnes', display: formatTonnes(footprint.airCo2eTonnes), intent: 'risk', hint: `${footprint.airExceptionCount} air shipments` },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Footprint & Hotspot Agent"
        title="Emission Hotspots"
        subtitle="Where the downstream transportation emissions concentrate — by product, customer, lane, port, mode, vendor and logistics provider. Act on the biggest first."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ mb: 3 }}>{kpis ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
        </Box>
      ) : <KpiSkeleton count={4} />}</Box>

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
          <ChartContainer title="By origin port (gateway)">
            <BarList items={toItems(hotspots.byOriginPort)} valueFormatter={formatTonnes} color="#C8841B" />
          </ChartContainer>
          {footprint && (
            <ChartContainer title="By mode">
              <ModeSplitDonut data={footprint.modeSplit} />
            </ChartContainer>
          )}
          <ChartContainer title="By vendor / processor">
            <BarList items={toItems(hotspots.byVendor)} valueFormatter={formatTonnes} color="#3F8F7A" />
          </ChartContainer>
          <ChartContainer title="By logistics provider (LSP)">
            <BarList items={toItems(hotspots.byLsp)} valueFormatter={formatTonnes} color="#9C6B3E" />
          </ChartContainer>
          <ChartContainer title="By origin region">
            <BarList items={toItems(hotspots.byOrigin)} valueFormatter={formatTonnes} color={MODE_COLORS.Road} />
          </ChartContainer>
        </Box>
      )}
    </Box>
  );
}
