import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ShipmentDetailDialog } from '@/components/shipments/ShipmentDetailDialog';
import { StatusChip } from '@/components/shared/Chips';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { Shipment } from '@/types';
import { APP_TODAY, STATUS_LABEL, addDaysISO } from '@/constants/app';
import { formatTonnes, formatDistance, formatNumber, formatWeightTonnes, formatIntensity, formatDate } from '@/utils/format';
import { insightsForRegister } from '@/utils/insights';

const STATUSES = ['All', 'Delivered', 'Planned'] as const;
const STREAMS = [
  { value: 'export', label: 'Export shipments' },
  { value: 'collection', label: 'First-mile collection' },
  { value: 'all', label: 'Everything' },
] as const;
type Stream = (typeof STREAMS)[number]['value'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 11, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * The shipment register — statement-style, newest first, scoped by the global
 * filters plus a local status and stream. A row click either tells the parent to
 * isolate that route on the map, or opens the full breakdown dialog.
 *
 * Export and collection are separated by default: the export chain is what a
 * route decision can change, collection is inbound raw material.
 */
export function ShipmentLedgerSection({
  onRowSelect,
  selectedId,
  compact = false,
}: {
  onRowSelect?: (s: Shipment) => void;
  selectedId?: string | null;
  compact?: boolean;
}) {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // With no explicit range the register shows history *and* the forward book, so
  // an unbooked shipment can be selected and re-routed. A user range still wins.
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
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('All');
  const [stream, setStream] = useState<Stream>('export');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    let items = result?.items ?? [];
    if (stream !== 'all') items = items.filter((s) => s.stream === stream);
    if (statusFilter !== 'All') items = items.filter((s) => s.status === statusFilter);
    return items;
  }, [result, stream, statusFilter]);

  const totals = useMemo(() => {
    const co2e = rows.reduce((a, s) => a + s.co2eTonnes, 0);
    const weight = rows.reduce((a, s) => a + s.weightTonnes, 0);
    const tonneKm = rows.reduce((a, s) => a + s.weightTonnes * s.totalDistanceKm, 0);
    const avoidable = rows.reduce((a, s) => a + s.avoidableTonnes, 0);
    const byStatus = rows.reduce<Record<string, number>>((acc, s) => ((acc[s.status] = (acc[s.status] ?? 0) + 1), acc), {});
    return { co2e, weight, avoidable, intensity: tonneKm ? (co2e * 1e6) / tonneKm : 0, byStatus };
  }, [rows]);

  // An open-ended range needs a phrase, not a placeholder: "start – Jul 31, 2026"
  // read like something had failed to load.
  const period = (() => {
    const { dateFrom, dateTo } = filters;
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
    if (dateTo) return `Everything up to ${formatDate(dateTo)}`;
    if (dateFrom) return `${formatDate(dateFrom)} onwards`;
    return 'Whole timeline · shipped and still to be planned';
  })();

  const allColumns: Column<Shipment>[] = [
    {
      key: 'id',
      header: 'Shipment ID',
      render: (s) => (
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            fontWeight: 600,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {s.shipmentId}
        </Typography>
      ),
      sortValue: (s) => s.shipmentId,
    },
    {
      key: 'date',
      header: 'Ship date',
      render: (s) => (
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatDate(s.date)}
        </Typography>
      ),
      sortValue: (s) => s.date,
    },
    {
      key: 'eta',
      header: 'ETA (est.)',
      render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDate(s.eta)}</span>,
      sortValue: (s) => s.eta,
    },
    { key: 'status', header: 'Status', render: (s) => <StatusChip status={s.status} />, sortValue: (s) => s.status },
    { key: 'year', header: 'Reporting year', render: (s) => s.reportingYear, sortValue: (s) => s.reportingYear },
    {
      key: 'lane',
      header: 'Lane',
      render: (s) => (
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, maxWidth: 190 }} title={`${s.origin} → ${s.destPort}`}>
          {s.origin} → {s.destPort}
        </Typography>
      ),
      sortValue: (s) => s.destPort,
    },
    { key: 'gateway', header: 'Gateway', render: (s) => s.gateway ?? '—', sortValue: (s) => s.gateway ?? '' },
    {
      key: 'product',
      header: 'Product',
      render: (s) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 260 }} title={s.productName}>
          {s.productName}
        </Typography>
      ),
      sortValue: (s) => s.productName,
    },
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
      render: (s) => (
        <strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatTonnes(s.co2eTonnes)}</strong>
      ),
      sortValue: (s) => s.co2eTonnes,
    },
    {
      key: 'avoidable',
      header: 'Avoidable',
      align: 'right',
      render: (s) =>
        s.avoidableTonnes > 0.0005 ? (
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: 'success.main', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
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

  // Compact view (for the split layout) keeps only the essentials — the full
  // detail opens in the panel alongside.
  const compactKeys = ['date', 'lane', 'product', 'co2e', 'avoidable'];
  // Percentages, so the five columns divide the split pane instead of demanding
  // their content width and scrolling sideways.
  const compactWidths: Record<string, string> = {
    date: '21%',
    lane: '21%',
    product: '22%',
    co2e: '18%',
    avoidable: '18%',
  };
  let columns = compact
    ? allColumns.filter((c) => compactKeys.includes(c.key)).map((c) => ({ ...c, width: compactWidths[c.key] }))
    : allColumns;
  if (stream === 'collection') columns = columns.filter((c) => !['gateway', 'avoidable', 'eta'].includes(c.key));

  const handleRow = (s: Shipment) => (onRowSelect ? onRowSelect(s) : setSelected(s.shipmentId));

  return (
    // In the split layout the parent hands down a minimum height that tracks the
    // panel opposite, so the register stretches to fill rather than leaving a gap
    // beside a taller right-hand panel. It is a floor, not a cap: the table keeps
    // its own scroll window, so nothing here can squeeze it.
    <Box sx={compact ? { display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}>
      <Card sx={{ mb: 2.5, flexShrink: 0 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={2}>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}
              >
                Statement period
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {period}
              </Typography>
            </Box>
            <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
              <Stat label="Shipments" value={formatNumber(rows.length)} />
              <Stat label="Total CO₂e" value={formatTonnes(totals.co2e)} />
              <Stat label="Total weight" value={`${formatNumber(totals.weight)} t`} />
              <Stat label="Avg intensity" value={formatIntensity(totals.intensity)} />
              {totals.avoidable > 0.0005 && <Stat label="Avoidable" value={formatTonnes(totals.avoidable)} />}
            </Stack>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {(['Delivered', 'Planned'] as const).map((st) =>
                totals.byStatus[st] ? (
                  <Chip
                    key={st}
                    size="small"
                    variant="outlined"
                    color={st === 'Planned' ? 'primary' : 'success'}
                    label={`${STATUS_LABEL[st] ?? st} ${totals.byStatus[st]}`}
                  />
                ) : null,
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <ChartContainer
        title="Shipment register"
        guideKey="shipment-register"
        insights={rows.length ? insightsForRegister(rows) : undefined}
        isEmpty={status !== 'loading' && Boolean(result) && rows.length === 0}
        emptyMessage="No movements match this period and filter set. Widen the date range or clear a filter."
        subtitle="Every movement on the timeline, newest first · click a row to trace its route and see its optimised route"
        icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
        action={
          <Stack direction="row" spacing={1}>
            <TextField select size="small" label="Show" value={stream} onChange={(e) => setStream(e.target.value as Stream)} sx={{ width: 168 }}>
              {STREAMS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])}
              sx={{ width: 150 }}
            >
              {STATUSES.map((st) => (
                <MenuItem key={st} value={st}>
                  {st === 'All' ? 'All' : (STATUS_LABEL[st] ?? st)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        }
      >
        {status === 'loading' || !result ? (
          <TableSkeleton rows={10} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(s) => s.shipmentId}
            onRowClick={handleRow}
            selectedRowKey={selectedId ?? selected}
            initialSortKey="date"
            // The table owns a viewport-relative scroll window rather than
            // taking whatever the pane has left over. Filling a definite pane
            // height meant the cards and controls stacked above it could starve
            // the table down to a couple of rows.
            maxHeightCss="clamp(320px, 62vh, 760px)"
            fixedLayout={compact}
          />
        )}
      </ChartContainer>

      {!onRowSelect && <ShipmentDetailDialog shipmentId={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
