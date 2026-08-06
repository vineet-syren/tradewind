import { Box, Chip, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import GridOnRounded from '@mui/icons-material/GridOnRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import type { WorkbookRow } from '@/types';
import { formatDate, formatNumber } from '@/utils/format';

const BLOCK_LABEL: Record<string, string> = {
  collection: 'ROADWAY #1 · first-mile collection',
  inland: 'ROADWAY #2 / RAILWAY · export inland legs',
  waterway: 'WATERWAY · ocean leg',
  airway: 'AIRWAY · air freight',
};

/**
 * The source rows behind a figure, shown as the spreadsheet holds them.
 *
 * This is the end of the reference chain. A total leads to a shipment, a
 * shipment to a leg, a leg to a cell range, and this resolves that range to the
 * row itself — the same quantity, distance, factor and CO₂e the sheet prints,
 * in the sheet's own columns.
 *
 * The recomputation is shown beside the workbook's own figure rather than
 * instead of it. Where the two differ by a few milligrams that is the sheet's
 * rounding, and hiding it would be the wrong way round: the app quotes the
 * workbook and shows its own working, so a reader can see both and judge.
 */
export function WorkbookRefDialog({ refs, onClose }: { refs: string[] | null; onClose: () => void }) {
  const ds = useDataSource();
  const { data: workbook, status } = useAsync(() => (refs?.length ? ds.getWorkbook() : Promise.resolve(null)), [refs?.join('|')]);

  const rows = (refs ?? []).map((r) => workbook?.rows[r]).filter((r): r is WorkbookRow => Boolean(r));
  const missing = (refs ?? []).filter((r) => workbook && !workbook.rows[r]);

  return (
    <Dialog open={Boolean(refs?.length)} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <GridOnRounded sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            In the source workbook
          </Typography>
          {refs?.map((r) => (
            <Chip key={r} size="small" label={r} sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }} />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {workbook ? `${workbook.file} — ${workbook.title}` : 'Resolving the cell range…'}
        </Typography>
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12 }} size="small">
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {status === 'loading' || !workbook ? (
          <TableSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No workbook row matches {missing.join(', ')}. Options priced across several shipments cite the first cell of
            each leg they use, so a reference can point at a row filtered out of the current build.
          </Typography>
        ) : (
          <Stack spacing={3}>
            {rows.map((row) => (
              <RowCard key={row.ref} row={row} />
            ))}
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Read straight from <b>{workbook.file}</b>. The CO₂e column is the figure the workbook itself prints for the
              row — the application quotes it rather than replacing it with its own recomputation, which is why an audit
              of any number here ends at a cell rather than at a model.
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RowCard({ row }: { row: WorkbookRow }) {
  const perTruck = row.efBasis === 'per-truck-km';
  // Re-derive the row from its own inputs, so the arithmetic is visible.
  const recomputed =
    row.distanceKm != null && row.emissionFactor != null
      ? perTruck
        ? (row.distanceKm * row.emissionFactor) / 1000
        : ((row.qtyKg ?? 0) / 1000) * row.distanceKm * row.emissionFactor / 1000
      : null;
  const drift = recomputed != null && row.co2eTonnes != null ? Math.abs(recomputed - row.co2eTonnes) : 0;

  const fields: [string, string][] = [
    ['Month', row.date ? formatDate(row.date) : '—'],
    ['Item transported', row.item ?? '—'],
    ['Quantity', row.qtyKg != null ? `${formatNumber(row.qtyKg)} kg` : '—'],
    ['Source', row.source ?? '—'],
    ['Destination', row.dest ?? '—'],
    ['Distance', row.distanceKm != null ? `${formatNumber(row.distanceKm)} km` : '—'],
    ...(row.distanceNm != null ? ([['Sea distance', `${formatNumber(row.distanceNm)} nautical miles`]] as [string, string][]) : []),
    ['Emission factor', row.emissionFactor != null ? `${row.emissionFactor} ${row.efUnit}` : '—'],
    ['CO₂e (as printed)', row.co2eTonnes != null ? `${row.co2eTonnes} t` : '—'],
    ...(row.container ? ([['Container', row.container]] as [string, string][]) : []),
    ...(row.fuelType ? ([['Fuel', row.fuelType]] as [string, string][]) : []),
    ...(row.fuelKl != null ? ([['Fuel consumed', `${row.fuelKl} kilolitres`]] as [string, string][]) : []),
    ...(row.trips != null ? ([['Monthly trips', String(row.trips)]] as [string, string][]) : []),
    ...(row.distPerTripKm != null ? ([['Distance per trip', `${formatNumber(row.distPerTripKm)} km`]] as [string, string][]) : []),
    ...(row.slNo != null ? ([['SL NO', String(row.slNo)]] as [string, string][]) : []),
  ];

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ px: 1.75, py: 1.25, bgcolor: 'action.hover' }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
          {row.ref}
        </Typography>
        <Chip size="small" variant="outlined" label={`tab ${row.tab} · ${row.reportingYear}`} />
        <Chip size="small" variant="outlined" label={BLOCK_LABEL[row.block] ?? row.block} />
        <Chip
          size="small"
          label={perTruck ? 'charged per truck run' : 'charged per tonne carried'}
          color={perTruck ? 'warning' : 'default'}
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '38%' }}>Column, as the sheet names it</TableCell>
              <TableCell>Value in this row</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell sx={{ color: 'text.secondary' }}>{k}</TableCell>
                <TableCell sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {recomputed != null && (
        <Box sx={{ px: 1.75, py: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10, color: 'primary.main', display: 'block', mb: 0.5 }}
          >
            Checked against its own inputs
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.7 }}
          >
            {perTruck
              ? `${formatNumber(row.distanceKm ?? 0)} km × ${row.emissionFactor} kg/km ÷ 1,000 = ${recomputed.toFixed(6)} t`
              : `${((row.qtyKg ?? 0) / 1000).toFixed(3)} t × ${formatNumber(row.distanceKm ?? 0)} km × ${row.emissionFactor} kg/t·km ÷ 1,000 = ${recomputed.toFixed(6)} t`}
          </Typography>
          <Typography variant="caption" color={drift > 1e-5 ? 'warning.dark' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
            {drift < 1e-9
              ? 'Matches the printed figure exactly.'
              : `The sheet prints ${row.co2eTonnes} t — a difference of ${(drift * 1e6).toFixed(2)} mg from its own rounding. The printed figure is the one this application reports.`}
          </Typography>
          {perTruck && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Note the quantity does not appear in this calculation. Road is charged per kilometre driven, so the{' '}
              {formatNumber(row.qtyKg ?? 0)} kg on this truck costs exactly what a full load would.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
