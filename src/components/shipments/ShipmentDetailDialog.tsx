import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import type { ReactNode } from 'react';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { ModeIcon } from '@/components/layout/iconRegistry';
import type { ApproachKind } from '@/types';
import { APPROACH_LABEL } from '@/constants/app';
import { formatTonnes, formatDistance, formatCurrency, formatNumber, formatWeightTonnes, formatIntensity, formatDate } from '@/utils/format';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  Delivered: 'success',
  'In transit': 'warning',
  Planned: 'info',
};

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    </Box>
  );
}

/** Full per-shipment breakdown — opened by clicking a row in the ledger. */
export function ShipmentDetailDialog({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const ds = useDataSource();
  const { data: s } = useAsync(() => (shipmentId ? ds.getShipment(shipmentId) : Promise.resolve(null)), [shipmentId]);
  const open = Boolean(shipmentId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {s && (
        <>
          <DialogTitle sx={{ pr: 6 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{s.origin} → {s.destPort}</Typography>
              <Chip size="small" color={STATUS_COLOR[s.status] ?? 'default'} label={s.status} />
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{s.shipmentId}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {s.productName} · {s.customer} · ships {formatDate(s.date)} → ETA {formatDate(s.eta)}
            </Typography>
            <IconButton onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12 }} size="small"><CloseRounded /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, mb: 2 }}>
              <Fact label="CO₂e" value={formatTonnes(s.co2eTonnes)} />
              <Fact label="Intensity" value={formatIntensity(s.co2ePerTonneKm)} />
              <Fact label="Weight" value={formatWeightTonnes(s.weightTonnes)} />
              <Fact label="Distance" value={formatDistance(s.totalDistanceKm)} />
              <Fact label="Freight cost" value={formatCurrency(s.freightUsd)} />
              <Fact label="Transit" value={`${s.transitDays} days`} />
              <Fact label="Carrier" value={s.carrier} />
              <Fact label="Vendor" value={s.vendor} />
              <Fact label="Origin gateway" value={s.originPort} />
              <Fact label="Market" value={s.market} />
              <Fact label="Mode path" value={s.modePath.join(' → ')} />
              <Fact label="Data confidence" value={s.dataConfidence} />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Legs</Typography>
            <Box sx={{ overflowX: 'auto', mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mode</TableCell>
                    <TableCell>From → To</TableCell>
                    <TableCell align="right">Distance</TableCell>
                    <TableCell align="right">EF</TableCell>
                    <TableCell align="right">CO₂e</TableCell>
                    <TableCell align="right">Fuel</TableCell>
                    <TableCell align="right">Transit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.legs.map((l) => (
                    <TableRow key={l.seq}>
                      <TableCell><Stack direction="row" spacing={0.75} alignItems="center"><ModeIcon mode={l.modeLabel} fontSize="small" />{l.modeLabel}</Stack></TableCell>
                      <TableCell>{l.from} → {l.to}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatDistance(l.distanceKm)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{l.emissionFactor.toFixed(3)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatTonnes(l.co2eTonnes)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(l.fuelLitres)} L</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{l.transitDaysExpected}d</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Route &amp; mode options</Typography>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
              {(['current', 'best', 'balanced', 'optimal'] as const).map((k) => {
                const sc = s.scenarios[k];
                if (!sc) return null;
                return (
                  <Box key={k} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                      {APPROACH_LABEL[sc.kind as ApproachKind] ?? sc.label}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                      <Typography variant="body2"><strong>{formatTonnes(sc.co2eTonnes)}</strong> CO₂e</Typography>
                      <Typography variant="body2" color="text.secondary">{formatCurrency(sc.freightUsd)}</Typography>
                      <Typography variant="body2" color="text.secondary">{sc.transitDays}d</Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Tip: the ledger reflects your current filters and date range — click any row for this breakdown.
            </Typography>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
