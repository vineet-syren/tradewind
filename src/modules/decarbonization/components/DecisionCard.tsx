import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import type { Recommendation, Shipment } from '@/types';
import { MODE_COLORS, OPTION_COLORS } from '@/constants/app';
import { TYPE_META } from '@/constants/actionTypes';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { SavingChip, SourceRef } from '@/components/shared/Chips';
import { formatDate, formatTonnes, formatWeightTonnes } from '@/utils/format';

/**
 * One decision, complete on the card.
 *
 * A decision is a *change*, not a shipment — the same gateway swap usually
 * applies to several shipments at once, so they are grouped. The card states
 * what to change, what it emits before and after, what it costs in time, and the
 * workbook evidence that the route is real. Selecting a shipment row traces it
 * on the map; that is the only interaction, and it is optional.
 */
export function DecisionCard({
  recs,
  shipments,
  selectedShipmentId,
  rank,
  onSelectShipment,
}: {
  /** Every shipment this same change applies to. Never empty. */
  recs: Recommendation[];
  /** Shipment facts by id, for the load / product line. */
  shipments: Map<string, Shipment>;
  selectedShipmentId?: string | null;
  /** 1-based position in the queue, so "the top three" is legible. */
  rank?: number;
  onSelectShipment?: (shipmentId: string) => void;
}) {
  const head = recs[0];
  const color = OPTION_COLORS[head.optionKind] ?? '#10b981';
  const meta = TYPE_META[head.type];
  const selected = recs.some((r) => r.shipmentId === selectedShipmentId);

  const totalSaving = recs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const rows = recs.map((r) => ({ rec: r, ship: r.shipmentId ? shipments.get(r.shipmentId) : undefined }));
  const totalToday = rows.reduce((s, x) => s + (x.ship?.co2eTonnes ?? 0), 0);
  const totalAfter = Math.max(0, totalToday - totalSaving);
  const savingPct = totalToday > 0 ? Math.round((totalSaving / totalToday) * 100) : 0;
  // Every shipment in a group shares the change, so transit impact is identical.
  const transitDays = head.transitImpactDays;
  const weight = rows.reduce((s, x) => s + (x.ship?.weightTonnes ?? 0), 0);

  return (
    <Card
      sx={{
        borderColor: selected ? color : undefined,
        borderWidth: selected ? 2 : 1,
        transition: 'border-color 120ms ease',
      }}
    >
      <CardContent>
        {/* Headline row: what the change is worth across every shipment it touches */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }} useFlexGap>
            {rank !== undefined && (
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: alpha(color, 0.14),
                  color,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {rank}
              </Box>
            )}
            <SavingChip tonnes={totalSaving} pct={savingPct} />
            {meta && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                <Box sx={{ display: 'inline-flex', '& svg': { fontSize: 15 } }}>{meta.icon}</Box>
                {meta.label}
              </Typography>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 700 }}>
            {recs.length} shipment{recs.length === 1 ? '' : 's'}
          </Typography>
        </Stack>

        {/* What to do */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {head.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {head.laneLabel} · {head.category} · {formatWeightTonnes(weight)} in total
        </Typography>

        {/* Now → Change to, the whole trade-off in one row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' },
            gap: 1,
            alignItems: 'stretch',
            mt: 1.5,
          }}
        >
          <Side heading="Now" co2e={totalToday} modes={head.fromModePath} via={head.gateway} />
          <Box sx={{ display: 'grid', placeItems: 'center', px: 0.5 }}>
            <ArrowForwardRoundedIcon sx={{ fontSize: 20, color, transform: { xs: 'rotate(90deg)', sm: 'none' } }} />
          </Box>
          <Side heading="Change to" co2e={totalAfter} modes={head.toModePath} accent={color} />
        </Box>

        {/* Time cost, stated plainly rather than buried */}
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25 }}>
          <ScheduleRoundedIcon sx={{ fontSize: 15, color: transitDays > 0 ? 'warning.main' : 'success.main' }} />
          <Typography variant="caption" color="text.secondary">
            {transitDays === 0
              ? 'No change to estimated transit time'
              : transitDays > 0
                ? `About ${transitDays} day${transitDays === 1 ? '' : 's'} slower (estimated)`
                : `About ${Math.abs(transitDays)} day${Math.abs(transitDays) === 1 ? '' : 's'} faster (estimated)`}
            {' · '}
            {head.complexity.toLowerCase()} effort to change
          </Typography>
        </Stack>

        {/* Which shipments it applies to — click one to trace it on the map */}
        <Box sx={{ mt: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {rows.map(({ rec, ship }, i) => {
            const isSel = rec.shipmentId === selectedShipmentId;
            return (
              <Stack
                key={rec.id}
                direction="row"
                alignItems="center"
                spacing={1}
                onClick={rec.shipmentId && onSelectShipment ? () => onSelectShipment(rec.shipmentId!) : undefined}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  cursor: onSelectShipment ? 'pointer' : 'default',
                  borderTop: i === 0 ? 0 : 1,
                  borderColor: 'divider',
                  bgcolor: isSel ? alpha(color, 0.08) : 'transparent',
                  '&:hover': onSelectShipment ? { bgcolor: alpha(color, 0.05) } : undefined,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isSel ? color : 'divider', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontWeight: isSel ? 700 : 500, whiteSpace: 'nowrap' }}>
                  {rec.shipmentDate ? formatDate(rec.shipmentDate) : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
                  {ship ? `${formatWeightTonnes(ship.weightTonnes)} · ${ship.productName}` : (rec.shipmentId ?? '')}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main', whiteSpace: 'nowrap' }}>
                  −{formatTonnes(rec.estCo2eSavingTonnes)}
                </Typography>
              </Stack>
            );
          })}
        </Box>

        {/* The evidence — why this is not a guess. Clamped until selected, so ten
            decisions still fit a reasonable scroll. */}
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: alpha(color, 0.06), border: 1, borderColor: alpha(color, 0.2) }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <VerifiedRoundedIcon sx={{ fontSize: 15, color }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
              Proven in your own records
            </Typography>
            {!selected && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, ml: 'auto' }}>
                select to read in full
              </Typography>
            )}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: selected ? 'unset' : 2,
              overflow: 'hidden',
              mt: 0.4,
              lineHeight: 1.5,
            }}
          >
            {head.proof}
          </Typography>
          {selected && <SourceRef refs={head.proofRefs} />}
        </Box>
      </CardContent>
    </Card>
  );
}

function Side({
  heading,
  co2e,
  modes,
  via,
  accent,
}: {
  heading: string;
  co2e: number;
  modes: string[];
  via?: string | null;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        border: 1,
        borderColor: accent ? alpha(accent, 0.35) : 'divider',
        bgcolor: accent ? alpha(accent, 0.05) : 'transparent',
        minWidth: 0,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          fontSize: 10,
          color: accent ?? 'text.secondary',
        }}
      >
        {heading}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, mt: 0.25 }}>
        {formatTonnes(co2e)}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.4 }}>
          CO₂e
        </Typography>
      </Typography>
      <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
        {modes.map((m, i) => (
          <Stack key={i} direction="row" spacing={0.3} alignItems="center">
            <ModeIcon mode={m} sx={{ fontSize: 15, color: MODE_COLORS[m] }} />
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11.5 }}>
              {m}
            </Typography>
            {i < modes.length - 1 && (
              <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>
                ›
              </Box>
            )}
          </Stack>
        ))}
        {via && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11.5, ml: 0.25 }}>
            via {via}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
