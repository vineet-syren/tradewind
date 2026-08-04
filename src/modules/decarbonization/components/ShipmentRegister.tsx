import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ShipmentDetailDialog } from '@/components/shipments/ShipmentDetailDialog';
import { StatusChip } from '@/components/shared/Chips';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { Shipment } from '@/types';
import { APP_TODAY, addDaysISO } from '@/constants/app';
import { formatTonnes, formatDistance, formatNumber, formatWeightTonnes, formatIntensity, formatDate } from '@/utils/format';

const STREAMS = [
  { value: 'export', label: 'Export shipments' },
  { value: 'collection', label: 'First-mile collection' },
  { value: 'all', label: 'Everything' },
] as const;
type Stream = (typeof STREAMS)[number]['value'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 11, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Every movement in the workbook, newest first. A row click opens the full leg
 * breakdown with each figure's source cell.
 *
 * Export and collection are separated by default because they answer different
 * questions — the export chain is what a route decision can change; collection
 * is inbound raw material and belongs in the total but not in the queue.
 */
export function ShipmentRegister({ onRowSelect, selectedId }: { onRowSelect?: (s: Shipment) => void; selectedId?: string | null }) {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // With no explicit range the register shows history *and* the forward book, so
  // an unbooked shipment can be found here too. A user-set range still wins.
  const wideRange = !filters.dateFrom && !filters.dateTo;
  const { data: result, status } = useAsync(
    () =>
      ds.getShipments({
        persona,
        ...filters,
        ...(wideRange ? { dateTo: addDaysISO(APP_TODAY, 400) } : {}),
        pageSize: 5000,
        sortBy: 'date',
        sortDir: 'desc',
      }),
    [persona, filters],
  );
  const [stream, setStream] = useState<Stream>('export');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const items = result?.items ?? [];
    return stream === 'all' ? items : items.filter((s) => s.stream === stream);
  }, [result, stream]);

  const totals = useMemo(() => {
    const co2e = rows.reduce((a, s) => a + s.co2eTonnes, 0);
    const weight = rows.reduce((a, s) => a + s.weightTonnes, 0);
    const tonneKm = rows.reduce((a, s) => a + s.weightTonnes * s.totalDistanceKm, 0);
    const avoidable = rows.reduce((a, s) => a + s.avoidableTonnes, 0);
    const open = rows.filter((s) => s.status === 'Planned').length;
    return { co2e, weight, avoidable, open, intensity: tonneKm ? (co2e * 1e6) / tonneKm : 0 };
  }, [rows]);

  const period =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? formatDate(filters.dateFrom) : 'start'} – ${filters.dateTo ? formatDate(filters.dateTo) : 'today'}`
      : 'Whole workbook · shipped + still to be planned';

  const allColumns: Column<Shipment>[] = [
    {
      key: 'id',
      header: 'Shipment',
      render: (s) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          {s.shipmentId}
        </Typography>
      ),
      sortValue: (s) => s.shipmentId,
    },
    {
      key: 'date',
      header: 'Dispatch',
      render: (s) => (
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatDate(s.date)}
        </Typography>
      ),
      sortValue: (s) => s.date,
    },
    { key: 'status', header: 'Status', render: (s) => <StatusChip status={s.status} />, sortValue: (s) => s.status },
    { key: 'year', header: 'Reporting year', render: (s) => s.reportingYear, sortValue: (s) => s.reportingYear },
    {
      key: 'lane',
      header: 'Route',
      render: (s) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {s.origin} → {s.destPort}
        </Typography>
      ),
      sortValue: (s) => s.destPort,
    },
    { key: 'gateway', header: 'Gateway', render: (s) => s.gateway ?? '—', sortValue: (s) => s.gateway ?? '' },
    { key: 'product', header: 'Product', render: (s) => s.productName, sortValue: (s) => s.productName },
    { key: 'category', header: 'Category', render: (s) => s.category, sortValue: (s) => s.category },
    {
      key: 'mode',
      header: 'Mode',
      render: (s) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ModeIcon mode={s.primaryMode} fontSize="small" />
          {s.primaryMode}
        </Stack>
      ),
      sortValue: (s) => s.primaryMode,
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatWeightTonnes(s.weightTonnes)}</span>,
      sortValue: (s) => s.weightTonnes,
    },
    {
      key: 'distance',
      header: 'Distance',
      align: 'right',
      render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDistance(s.totalDistanceKm)}</span>,
      sortValue: (s) => s.totalDistanceKm,
    },
    {
      key: 'co2e',
      header: 'CO₂e',
      align: 'right',
      render: (s) => <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTonnes(s.co2eTonnes)}</strong>,
      sortValue: (s) => s.co2eTonnes,
    },
    {
      key: 'avoidable',
      header: 'Avoidable',
      align: 'right',
      render: (s) =>
        s.avoidableTonnes > 0.0005 ? (
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', fontVariantNumeric: 'tabular-nums' }}>
            {formatTonnes(s.avoidableTonnes)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
      sortValue: (s) => s.avoidableTonnes,
    },
    {
      key: 'intensity',
      header: 'g/t·km',
      align: 'right',
      render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIntensity(s.co2ePerTonneKm)}</span>,
      sortValue: (s) => s.co2ePerTonneKm,
    },
  ];

  const columns = stream === 'collection' ? allColumns.filter((c) => !['gateway', 'avoidable'].includes(c.key)) : allColumns;
  const handleRow = (s: Shipment) => (onRowSelect ? onRowSelect(s) : setSelected(s.shipmentId));

  return (
    <Box>
      <FilterPanel />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={2}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
                In view
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {period}
              </Typography>
            </Box>
            <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
              <Stat label="Movements" value={formatNumber(rows.length)} />
              <Stat label="CO₂e" value={formatTonnes(totals.co2e)} />
              <Stat label="Weight" value={`${formatNumber(totals.weight)} t`} />
              <Stat label="Intensity" value={formatIntensity(totals.intensity)} />
              {totals.avoidable > 0.0005 && <Stat label="Avoidable" value={formatTonnes(totals.avoidable)} />}
            </Stack>
            {totals.open > 0 && <Chip size="small" color="primary" variant="outlined" label={`${totals.open} still to be planned`} />}
          </Stack>
        </CardContent>
      </Card>

      <ChartContainer
        title="Shipment register"
        subtitle="Every movement the workbook records · click a row for its legs, factors and source cells"
        icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
        action={
          <TextField select size="small" label="Show" value={stream} onChange={(e) => setStream(e.target.value as Stream)} sx={{ width: 190 }}>
            {STREAMS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        }
      >
        {status === 'loading' || !result ? (
          <TableSkeleton rows={10} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            No movements match this period and filter set. Widen the date range or clear a filter.
          </Typography>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(s) => s.shipmentId}
            onRowClick={handleRow}
            selectedRowKey={selectedId ?? selected}
            initialSortKey="date"
            maxHeight={620}
          />
        )}
      </ChartContainer>

      {!onRowSelect && <ShipmentDetailDialog shipmentId={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
