import { Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import type { ReactNode } from 'react';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { ModeChip, SourceRef, StatusChip } from '@/components/shared/Chips';
import { LegTimeline } from '@/modules/decarbonization/components/LegTimeline';
import { ScenarioCard } from '@/modules/decarbonization/components/ScenarioCard';
import { formatTonnes, formatDistance, formatWeightTonnes, formatIntensity, formatDate, formatLitres } from '@/utils/format';

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Full per-shipment breakdown — opened by clicking a row in the register. */
export function ShipmentDetailDialog({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const ds = useDataSource();
  const { data: s, status } = useAsync(() => (shipmentId ? ds.getShipment(shipmentId) : Promise.resolve(null)), [shipmentId]);
  const open = Boolean(shipmentId);
  const best = s?.options.find((o) => !o.isCurrent);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {status === 'loading' && !s ? (
        <DialogContent>
          <TableSkeleton rows={6} />
        </DialogContent>
      ) : s ? (
        <>
          <DialogTitle sx={{ pr: 6 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {s.origin} → {s.destPort}
              </Typography>
              <StatusChip status={s.status} />
              <ModeChip mode={s.primaryMode} />
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {s.shipmentId}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {s.productName} · {formatWeightTonnes(s.weightTonnes)} · dispatched {formatDate(s.date)} · {s.reportingYear}
            </Typography>
            <IconButton onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12 }} size="small">
              <CloseRounded />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, mb: 2.5 }}>
              <Fact label="CO₂e" value={formatTonnes(s.co2eTonnes)} />
              <Fact label="Intensity" value={formatIntensity(s.co2ePerTonneKm)} />
              <Fact label="Distance" value={formatDistance(s.totalDistanceKm)} />
              <Fact label="Transit (est.)" value={`${s.transitDaysEst} days`} />
              <Fact label="Gateway" value={s.gateway ?? 'Flown out'} />
              <Fact label="Depot" value={s.icd ?? '—'} />
              <Fact label="Container" value={s.containerType ?? '—'} />
              <Fact label="Market" value={s.market} />
              <Fact label="Category" value={s.category} />
              <Fact label="Scoville" value={s.shu ? `${s.shu.toLocaleString('en-US')} SHU` : '—'} />
              <Fact label="Diesel" value={s.fuelLitres ? formatLitres(s.fuelLitres) : '—'} />
              <Fact label="Mode chain" value={s.modePath.join(' → ')} />
            </Box>

            {s.derivedFromRef && (
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', mb: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Still to be planned
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rolled forward from a real shipment one year earlier — same product, weight, gateway and distances, with only
                  the dates moved.
                </Typography>
                <SourceRef refs={[s.derivedFromRef]} label="Derived from" />
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Legs &amp; calculation
            </Typography>
            <Box sx={{ mb: 2.5 }}>
              <LegTimeline legs={s.legs} />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {s.options.length > 1 ? 'Route options the workbook evidences' : 'Route as recorded'}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
              {s.options.map((o) => (
                <ScenarioCard key={o.id} option={o} recommended={!o.isCurrent && o.id === best?.id} compact />
              ))}
            </Box>
            {s.options.length === 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                No alternative appears here because the workbook records no other routing that would reach this destination for
                less. Options are never invented.
              </Typography>
            )}

            <SourceRef refs={[s.sourceRef]} />
          </DialogContent>
        </>
      ) : null}
    </Dialog>
  );
}
