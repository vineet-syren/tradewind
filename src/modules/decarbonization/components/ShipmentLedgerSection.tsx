import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ShipmentDetailDialog } from '@/components/shipments/ShipmentDetailDialog';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { Shipment } from '@/types';
import { APP_TODAY, STATUS_LABEL, addDaysISO } from '@/constants/app';
import { formatTonnes, formatDistance, formatCurrency, formatNumber, formatWeightTonnes, formatIntensity, formatDate } from '@/utils/format';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  Delivered: 'success',
  'In transit': 'warning',
  Planned: 'info',
};
const STATUSES = ['All', 'Delivered', 'In transit', 'Planned'] as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 11, display: 'block' }}>{label}</Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

/**
 * The shipment register — statement-style, newest first, filterable by the
 * global period + filters plus a local status. A row click opens the full
 * breakdown and (optionally) tells the parent to isolate that route on the map.
 */
export function ShipmentLedgerSection({ onRowSelect, selectedId, compact = false }: { onRowSelect?: (s: Shipment) => void; selectedId?: string | null; compact?: boolean }) {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // The register is the full shipment book — with no explicit range it shows
  // both actuals and upcoming (planned) shipments, so upcoming ones can be
  // selected and re-routed. A user-set range still scopes it.
  const wideRange = !filters.dateFrom && !filters.dateTo;
  const { data: result, status } = useAsync(
    () => ds.getShipments({ persona, ...filters, ...(wideRange ? { dateTo: addDaysISO(APP_TODAY, 400) } : {}), pageSize: 5000, sortBy: 'date', sortDir: 'desc' }),
    [persona, filters],
  );
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('All');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const items = result?.items ?? [];
    return statusFilter === 'All' ? items : items.filter((s) => s.status === statusFilter);
  }, [result, statusFilter]);

  const totals = useMemo(() => {
    const co2e = rows.reduce((a, s) => a + s.co2eTonnes, 0);
    const weight = rows.reduce((a, s) => a + s.weightTonnes, 0);
    const tonKm = rows.reduce((a, s) => a + s.weightTonnes * s.totalDistanceKm, 0);
    const byStatus = rows.reduce<Record<string, number>>((acc, s) => ((acc[s.status] = (acc[s.status] ?? 0) + 1), acc), {});
    return { co2e, weight, intensity: tonKm ? (co2e * 1e6) / tonKm : 0, byStatus };
  }, [rows]);

  const period = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom ? formatDate(filters.dateFrom) : 'start'} – ${filters.dateTo ? formatDate(filters.dateTo) : 'today'}`
    : 'All shipments · past + planned';

  const allColumns: Column<Shipment>[] = [
    {
      key: 'id',
      header: 'Shipment ID',
      render: (s) => (
        <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {s.shipmentId}
        </Typography>
      ),
      sortValue: (s) => s.shipmentId,
    },
    { key: 'date', header: 'Ship date', render: (s) => <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatDate(s.date)}</Typography>, sortValue: (s) => s.date },
    { key: 'eta', header: 'ETA', render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(s.eta)}</span>, sortValue: (s) => s.eta },
    { key: 'status', header: 'Status', render: (s) => <Chip size="small" color={STATUS_COLOR[s.status] ?? 'default'} label={STATUS_LABEL[s.status] ?? s.status} />, sortValue: (s) => s.status },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (s) =>
        s.status === 'Planned' ? (
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {formatDate(addDaysISO(s.date, -3))}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ),
      sortValue: (s) => (s.status === 'Planned' ? s.date : ''),
    },
    { key: 'lane', header: 'Lane', render: (s) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.origin} → {s.destPort}</Typography>, sortValue: (s) => s.origin },
    { key: 'product', header: 'Product', render: (s) => s.productName, sortValue: (s) => s.productName },
    { key: 'customer', header: 'Customer', render: (s) => s.customer, sortValue: (s) => s.customer },
    { key: 'vendor', header: 'Vendor', render: (s) => s.vendor, sortValue: (s) => s.vendor },
    { key: 'mode', header: 'Mode', render: (s) => <Stack direction="row" spacing={0.5} alignItems="center"><ModeIcon mode={s.primaryMode} fontSize="small" />{s.primaryMode}</Stack>, sortValue: (s) => s.primaryMode },
    { key: 'weight', header: 'Weight', align: 'right', render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatWeightTonnes(s.weightTonnes)}</span>, sortValue: (s) => s.weightTonnes },
    { key: 'distance', header: 'Distance', align: 'right', render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDistance(s.totalDistanceKm)}</span>, sortValue: (s) => s.totalDistanceKm },
    { key: 'freight', header: 'Freight', align: 'right', render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.freightUsd)}</span>, sortValue: (s) => s.freightUsd },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (s) => <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTonnes(s.co2eTonnes)}</strong>, sortValue: (s) => s.co2eTonnes },
    { key: 'intensity', header: 'g/t·km', align: 'right', render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIntensity(s.co2ePerTonneKm)}</span>, sortValue: (s) => s.co2ePerTonneKm },
    { key: 'carrier', header: 'Carrier', render: (s) => s.carrier, sortValue: (s) => s.carrier },
  ];
  // Compact view (for the split layout) keeps only the essentials — full detail
  // opens in the panel alongside.
  const compactKeys = ['id', 'date', 'status', 'deadline', 'lane', 'product', 'customer', 'vendor', 'co2e'];
  const columns = compact ? allColumns.filter((c) => compactKeys.includes(c.key)) : allColumns;
  const handleRow = (s: Shipment) => { if (onRowSelect) onRowSelect(s); else setSelected(s.shipmentId); };

  return (
    <Box>
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={2}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>Statement period</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{period}</Typography>
            </Box>
            <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
              <Stat label="Shipments" value={formatNumber(rows.length)} />
              <Stat label="Total CO₂e" value={formatTonnes(totals.co2e)} />
              <Stat label="Total weight" value={`${formatNumber(totals.weight)} t`} />
              <Stat label="Avg intensity" value={formatIntensity(totals.intensity)} />
            </Stack>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {(['Delivered', 'In transit', 'Planned'] as const).map((st) =>
                totals.byStatus[st] ? <Chip key={st} size="small" variant="outlined" color={STATUS_COLOR[st]} label={`${STATUS_LABEL[st] ?? st} ${totals.byStatus[st]}`} /> : null,
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <ChartContainer
        title="Shipment register"
        subtitle="Every shipment, newest first · click a row to trace its route on the map and see the full breakdown"
        icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
        action={
          <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])} sx={{ width: 150 }}>
            {STATUSES.map((st) => <MenuItem key={st} value={st}>{st === 'All' ? 'All' : STATUS_LABEL[st] ?? st}</MenuItem>)}
          </TextField>
        }
      >
        {status === 'loading' || !result ? (
          <TableSkeleton rows={10} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            No shipments match this period and filter set. Widen the date range or clear a filter.
          </Typography>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(s) => s.shipmentId}
            onRowClick={handleRow}
            selectedRowKey={selectedId ?? selected}
            initialSortKey="date"
            maxHeightCss={compact ? 'calc(100vh - 210px)' : undefined}
            maxHeight={compact ? undefined : 620}
          />
        )}
      </ChartContainer>

      {!onRowSelect && <ShipmentDetailDialog shipmentId={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
