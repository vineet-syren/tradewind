import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScatterBubbleChart, SwatchLegend, type BubblePoint } from '@/components/charts/ScatterBubbleChart';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { KpiMetric, LspPartner, VendorPartner } from '@/types';
import { formatTonnes } from '@/utils/format';

const CONTROL_X: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

export default function PartnerInfluencePage() {
  const ds = useDataSource();
  const theme = useTheme();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: partners, status } = useAsync(() => ds.getPartners({ persona, filters }), [persona, filters]);

  const influenceable = partners && [...partners.lsps, ...partners.vendors].reduce((s, p) => s + p.influenceableSavingTonnes, 0);
  const worstLsp = partners && [...partners.lsps].sort((a, b) => b.intensityIndex - a.intensityIndex)[0];
  const greenShare = partners && partners.lsps.length
    ? Math.round((partners.lsps.filter((l) => l.greenProgram).reduce((s, l) => s + l.co2eTonnes, 0) / Math.max(partners.lsps.reduce((s, l) => s + l.co2eTonnes, 0), 0.001)) * 100)
    : 0;

  const kpis: KpiMetric[] | undefined = partners && [
    { id: 'infl', label: 'Influenceable saving', value: influenceable ?? 0, unit: 'tonnes', display: `${formatTonnes(influenceable ?? 0)}/yr`, intent: 'opportunity', hint: 'via carrier & vendor levers' },
    { id: 'green', label: 'Green-fleet share', value: greenShare, unit: 'percent', intent: greenShare > 50 ? 'positive' : 'neutral', hint: 'of carrier CO₂e' },
    { id: 'worst', label: 'Highest-intensity carrier', value: worstLsp ? Math.round((worstLsp.intensityIndex - 1) * 100) : 0, unit: 'percent', display: worstLsp ? `+${Math.round((worstLsp.intensityIndex - 1) * 100)}%` : '—', intent: 'risk', hint: worstLsp?.name },
    { id: 'partners', label: 'Active partners', value: (partners.lsps.length + partners.vendors.length), unit: 'number', intent: 'neutral', hint: `${partners.lsps.length} carriers · ${partners.vendors.length} vendors` },
  ];

  const carrierPoints: BubblePoint[] = (partners?.lsps ?? []).map((l) => ({
    name: l.name,
    x: l.intensityIndex,
    y: l.co2eTonnes,
    z: l.shipments,
    color: l.greenProgram ? theme.palette.success.main : l.intensityIndex > 1.02 ? theme.palette.error.main : theme.palette.secondary.main,
    meta: `${l.carrier} · ${formatTonnes(l.influenceableSavingTonnes)}/yr influenceable`,
  }));

  const vendorPoints: BubblePoint[] = (partners?.vendors ?? []).map((v) => ({
    name: v.name,
    x: CONTROL_X[v.controllability] ?? 2,
    y: v.co2eTonnes,
    z: Math.max(v.influenceableSavingTonnes, 0.5),
    color: v.controllability === 'High' ? theme.palette.success.main : v.controllability === 'Low' ? theme.palette.error.main : theme.palette.warning.main,
    meta: `${v.origin} · ${v.controllability} controllability`,
  }));

  const lspCols: Column<LspPartner>[] = [
    { key: 'name', header: 'Carrier', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.name}</Typography>, sortValue: (l) => l.name },
    { key: 'intensity', header: 'vs fleet', align: 'center', render: (l) => <Chip size="small" variant="outlined" color={l.intensityIndex > 1.02 ? 'error' : l.intensityIndex < 0.95 ? 'success' : 'default'} label={`${l.intensityIndex > 1 ? '+' : ''}${Math.round((l.intensityIndex - 1) * 100)}%`} />, sortValue: (l) => l.intensityIndex },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.co2eTonnes)}</strong>, sortValue: (l) => l.co2eTonnes },
    { key: 'infl', header: 'Save/yr', align: 'right', render: (l) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(l.influenceableSavingTonnes)}</span>, sortValue: (l) => l.influenceableSavingTonnes },
  ];
  const vendorCols: Column<VendorPartner>[] = [
    { key: 'name', header: 'Vendor', render: (v) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.name}</Typography>, sortValue: (v) => v.name },
    { key: 'control', header: 'Control', align: 'center', render: (v) => <Chip size="small" variant="outlined" color={v.controllability === 'High' ? 'success' : v.controllability === 'Low' ? 'error' : 'warning'} label={v.controllability} />, sortValue: (v) => CONTROL_X[v.controllability] ?? 2 },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (v) => <strong>{formatTonnes(v.co2eTonnes)}</strong>, sortValue: (v) => v.co2eTonnes },
    { key: 'infl', header: 'Save/yr', align: 'right', render: (v) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(v.influenceableSavingTonnes)}</span>, sortValue: (v) => v.influenceableSavingTonnes },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Partner Influence Agent"
        title="Carrier & Vendor Performance"
        subtitle="Terova outsources execution, so part of the reduction sits with carriers and vendors. Benchmark them on emissions vs intensity and find the influenceable saving."
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

      {/* Carriers: benchmark scatter + detail table */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, mb: 3 }}>
        <ChartContainer title="Carrier benchmark" subtitle="Volume (CO₂e) vs fleet intensity · bubble = shipments · right of the line = above fleet average">
          {partners ? (
            <>
              <ScatterBubbleChart points={carrierPoints} xLabel="Fleet intensity (1.0 = avg)" yLabel="CO₂e" sizeLabel="Shipments" xFormat={(v) => `${v.toFixed(2)}×`} yFormat={formatTonnes} refX={1} refXLabel="fleet avg" height={300} />
              <SwatchLegend items={[{ color: theme.palette.success.main, label: 'Green fleet' }, { color: theme.palette.secondary.main, label: 'At/near average' }, { color: theme.palette.error.main, label: 'Above average' }]} />
            </>
          ) : <ChartSkeleton height={300} />}
        </ChartContainer>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Carriers</Typography>
            {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={lspCols} rows={partners.lsps} getRowKey={(l) => l.name} initialSortKey="co2e" />}
          </CardContent>
        </Card>
      </Box>

      {/* Vendors: controllability matrix + detail table */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' } }}>
        <ChartContainer title="Vendor governance matrix" subtitle="Emissions vs controllability · bubble = influenceable saving · top-left = high impact, harder to control (govern first)">
          {partners ? (
            <>
              <ScatterBubbleChart points={vendorPoints} xLabel="Controllability" yLabel="CO₂e" sizeLabel="Influenceable / yr" xFormat={(v) => ['', 'Low', 'Medium', 'High'][v] ?? ''} yFormat={formatTonnes} xDomain={[0.5, 3.5]} height={300} />
              <SwatchLegend items={[{ color: theme.palette.success.main, label: 'High control' }, { color: theme.palette.warning.main, label: 'Medium' }, { color: theme.palette.error.main, label: 'Low control' }]} />
            </>
          ) : <ChartSkeleton height={300} />}
        </ChartContainer>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Vendors / processors</Typography>
            {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={vendorCols} rows={partners.vendors} getRowKey={(v) => v.name} initialSortKey="co2e" />}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
