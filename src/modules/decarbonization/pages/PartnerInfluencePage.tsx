import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { KpiCard } from '@/components/cards/KpiCard';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { KpiSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import type { KpiMetric, LspPartner, VendorPartner } from '@/types';
import { formatTonnes } from '@/utils/format';

export default function PartnerInfluencePage() {
  const ds = useDataSource();
  const { data: partners, status } = useAsync(() => ds.getPartners(), []);

  const influenceable =
    partners &&
    [...partners.vendors, ...partners.lsps].reduce((s, p) => s + p.influenceableSavingTonnes, 0);
  const worstLsp = partners && [...partners.lsps].sort((a, b) => b.intensityIndex - a.intensityIndex)[0];

  const kpis: KpiMetric[] | undefined = partners && [
    { id: 'infl', label: 'Influenceable saving', value: influenceable ?? 0, unit: 'tonnes', display: `${formatTonnes(influenceable ?? 0)}/yr`, intent: 'opportunity', hint: 'via vendors & LSPs' },
    { id: 'vendors', label: 'Vendors / processors', value: partners.vendors.length, unit: 'number', intent: 'neutral', hint: 'origin handoff partners' },
    { id: 'lsps', label: 'Logistics providers', value: partners.lsps.length, unit: 'number', intent: 'neutral', hint: 'forwarders & carriers' },
    { id: 'worst', label: 'Highest-intensity LSP', value: worstLsp ? Math.round((worstLsp.intensityIndex - 1) * 100) : 0, unit: 'percent', display: worstLsp ? `+${Math.round((worstLsp.intensityIndex - 1) * 100)}%` : '—', intent: 'risk', hint: worstLsp?.name },
  ];

  const lspCols: Column<LspPartner>[] = [
    { key: 'name', header: 'LSP', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.name}</Typography>, sortValue: (l) => l.name },
    { key: 'carrier', header: 'Carrier', render: (l) => l.carrier, sortValue: (l) => l.carrier },
    { key: 'intensity', header: 'Intensity vs fleet', align: 'center', render: (l) => (
        <Chip size="small" color={l.intensityIndex > 1.02 ? 'error' : l.intensityIndex < 0.95 ? 'success' : 'default'} variant="outlined" label={`${l.intensityIndex > 1 ? '+' : ''}${Math.round((l.intensityIndex - 1) * 100)}%`} />
      ), sortValue: (l) => l.intensityIndex },
    { key: 'green', header: 'Green program', align: 'center', render: (l) => (l.greenProgram ? <Chip size="small" color="success" label="Yes" /> : <Chip size="small" variant="outlined" label="No" />), sortValue: (l) => (l.greenProgram ? 1 : 0) },
    { key: 'ships', header: 'Shipments', align: 'right', render: (l) => l.shipments, sortValue: (l) => l.shipments },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.co2eTonnes)}</strong>, sortValue: (l) => l.co2eTonnes },
    { key: 'infl', header: 'Influenceable/yr', align: 'right', render: (l) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(l.influenceableSavingTonnes)}</span>, sortValue: (l) => l.influenceableSavingTonnes },
  ];

  const vendorCols: Column<VendorPartner>[] = [
    { key: 'name', header: 'Vendor / processor', render: (v) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.name}</Typography>, sortValue: (v) => v.name },
    { key: 'origin', header: 'Origin', render: (v) => v.origin, sortValue: (v) => v.origin },
    { key: 'control', header: 'Controllability', align: 'center', render: (v) => (
        <Chip size="small" variant="outlined" color={v.controllability === 'High' ? 'success' : v.controllability === 'Low' ? 'error' : 'warning'} label={v.controllability} />
      ), sortValue: (v) => v.controllability },
    { key: 'ships', header: 'Shipments', align: 'right', render: (v) => v.shipments, sortValue: (v) => v.shipments },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (v) => <strong>{formatTonnes(v.co2eTonnes)}</strong>, sortValue: (v) => v.co2eTonnes },
    { key: 'infl', header: 'Influenceable/yr', align: 'right', render: (v) => <span style={{ color: '#0C8B7B', fontWeight: 700 }}>{formatTonnes(v.influenceableSavingTonnes)}</span>, sortValue: (v) => v.influenceableSavingTonnes },
  ];

  return (
    <Box>
      <PageHeader
        overline="Intelligence · Partner Influence Agent"
        title="Partner Influence"
        subtitle="Terova outsources execution, so part of the reduction sits with vendors, processors and logistics providers. Map their contribution and the saving Terova can influence."
        actions={<ScopeNote />}
      />

      <Box sx={{ mb: 3 }}>{kpis ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
        </Box>
      ) : <KpiSkeleton count={4} />}</Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Logistics providers (LSP / carrier)
          </Typography>
          {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={lspCols} rows={partners.lsps} getRowKey={(l) => l.name} initialSortKey="co2e" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Vendors / processors
          </Typography>
          {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={vendorCols} rows={partners.vendors} getRowKey={(v) => v.name} initialSortKey="co2e" />}
        </CardContent>
      </Card>
    </Box>
  );
}
