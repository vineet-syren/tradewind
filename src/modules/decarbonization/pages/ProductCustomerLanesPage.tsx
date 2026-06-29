import { Box, Card, CardContent, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarList } from '@/components/charts/BarList';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { ApproachChip } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { Lane } from '@/types';
import { formatTonnes } from '@/utils/format';

export default function ProductCustomerLanesPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ filters, sortBy: 'co2e' }), [filters]);
  const { data: hotspots } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);

  const columns: Column<Lane>[] = [
    { key: 'lane', header: 'Lane', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.origin} → {l.destPort}</Typography>, sortValue: (l) => l.origin },
    { key: 'product', header: 'Product', render: (l) => l.productCategory, sortValue: (l) => l.productCategory },
    { key: 'customer', header: 'Customer', render: (l) => l.customer, sortValue: (l) => l.customer },
    { key: 'market', header: 'Market', render: (l) => l.market, sortValue: (l) => l.market },
    { key: 'ships', header: 'Shipments', align: 'right', render: (l) => l.shipmentCount, sortValue: (l) => l.shipmentCount },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.totalCo2eTonnes)}</strong>, sortValue: (l) => l.totalCo2eTonnes },
    { key: 'reduction', header: 'Reduction/yr', align: 'right', render: (l) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(l.realizableReductionTonnes)}</span>, sortValue: (l) => l.realizableReductionTonnes },
    { key: 'approach', header: 'Recommended', align: 'center', render: (l) => <ApproachChip kind={l.recommendedApproach} />, sortValue: (l) => l.recommendedApproach },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Commercial + Supply Chain"
        title="Customer & Product Lanes"
        subtitle="Emissions by product category, customer, market and shipment count — to prioritize the customer-product lanes worth a reduction conversation."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mb: 3 }}>
        {hotspots ? (
          <>
            <ChartContainer title="CO₂e by product category">
              <BarList items={hotspots.byProductCategory.map((r) => ({ label: r.label, value: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} />
            </ChartContainer>
            <ChartContainer title="CO₂e by customer">
              <BarList items={hotspots.byCustomer.map((r) => ({ label: r.label, value: r.co2eTonnes, sub: `${r.shipments} shipments` }))} valueFormatter={formatTonnes} color="#1E6E8C" />
            </ChartContainer>
          </>
        ) : (
          <>
            <ChartSkeleton height={240} />
            <ChartSkeleton height={240} />
          </>
        )}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            All lanes · {lanes?.length ?? 0}
          </Typography>
          {status === 'loading' || !lanes ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable
              columns={columns}
              rows={lanes}
              getRowKey={(l) => l.laneId}
              onRowClick={(l) => dispatch(setSelectedLane(l.laneId))}
              initialSortKey="co2e"
              maxHeight={620}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
