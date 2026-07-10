import { type ReactNode } from 'react';
import { Box, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import type { LaneDetail, Recommendation } from '@/types';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { ModePathChange } from '@/components/shared/ModePath';
import { APPROACH_LABEL } from '@/constants/app';
import { TYPE_META } from '@/constants/actionTypes';
import { formatCurrency, formatTonnes, formatIntensity } from '@/utils/format';

const APPROACH_SCENARIO: Record<string, keyof LaneDetail['scenarios']> = {
  current: 'current',
  best_co2: 'best',
  balanced: 'balanced',
  optimal: 'optimal',
};

export function LaneDetailContent({ laneId, readOnly = false }: { laneId: string; /** Opened from a shipped/in-transit shipment — decision locked, show only the route taken. */ readOnly?: boolean }) {
  const ds = useDataSource();
  const { data: lane, status } = useAsync(() => ds.getLane(laneId), [laneId]);

  if (status === 'loading') return <TableSkeleton rows={6} />;
  if (!lane) return <Typography color="text.secondary">Lane not found.</Typography>;

  const annualFreq = lane.annualFrequency;
  const recKey = APPROACH_SCENARIO[lane.recommendedApproach] ?? 'best';
  const recScenario = lane.scenarios[recKey];
  const cur = lane.scenarios.current;
  const cutPct = cur.co2eTonnes > 0 ? Math.round(((cur.co2eTonnes - recScenario.co2eTonnes) / cur.co2eTonnes) * 100) : 0;
  const annualSave = Math.max(0, recScenario.co2eDeltaTonnes) * annualFreq;
  const transitDelta = recScenario.transitDays - cur.transitDays;
  const suggestions = [...lane.recommendations].sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">
          Lane 360 · Route visibility &amp; suggestions
        </Typography>
        {/* Route endpoints labelled Source / Destination */}
        <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mt: 0.25 }}>
          <LabelledPlace name={lane.origin} label="Source" big />
          <Box component="span" sx={{ fontSize: 22, color: 'text.secondary', mt: 0.3 }}>→</Box>
          <LabelledPlace name={lane.destPort} label="Destination" big />
        </Stack>
      </Box>

      {/* Who & what — every value under its own label */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Metric label="Product" value={lane.productCategory} />
        <Metric label="Customer" value={`${lane.customer} · ${lane.market}`} />
        <Metric label="Vendor (prepares goods)" value={lane.vendor} />
        <Metric label="LSP (books freight)" value={lane.lsp} />
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Metric label="Total CO₂e (lane)" value={formatTonnes(lane.totalCo2eTonnes)} />
        <Metric label="Avoidable per year" value={`${formatTonnes(lane.realizableReductionTonnes)}/yr`} accent />
        <Metric label="Shipments · annual trips" value={`${lane.shipmentCount} · ${lane.annualFrequency}/yr`} />
        <Metric label="Intensity" value={formatIntensity(lane.avgCo2ePerTonneKm)} />
      </Box>

      {/* Lane brief — the plain-English story of this route */}
      <Card sx={{ border: 1, borderColor: (t) => alpha(t.palette.primary.main, 0.35), background: (t) => `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${t.palette.background.paper} 65%)` }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AutoAwesomeRounded sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Lane brief</Typography>
            <Chip size="small" variant="outlined" color="primary" label="Computed from lane data" sx={{ ml: 'auto' }} />
          </Stack>
          <Stack spacing={0.75}>
            {readOnly ? (
              <>
                <Brief>
                  This shipment is <b>already underway or delivered</b> — the routing decision was made at booking. The route as executed
                  emits <b>{formatTonnes(cur.co2eTonnes)}</b> of CO₂e per shipment.
                </Brief>
                {lane.airSharePct > 0 && (
                  <Brief>
                    <b>{Math.round(lane.airSharePct)}%</b> of this route&apos;s CO₂e comes from shipments that went by air (plane) — reviewing
                    why they flew is the quickest improvement for future bookings.
                  </Brief>
                )}
                <Brief>
                  Future bookings on this route could still avoid about <b>{formatTonnes(annualSave)} per year</b> — the suggestions below
                  apply to those.
                </Brief>
              </>
            ) : (
              <>
                <Brief>
                  Shipments on this route currently emit <b>{formatTonnes(cur.co2eTonnes)}</b> of CO₂e each. Our suggested option,{' '}
                  <b>{APPROACH_LABEL[lane.recommendedApproach]}</b>, would bring that down to <b>{formatTonnes(recScenario.co2eTonnes)}</b>
                  {cutPct > 0 ? <> — about <b>{cutPct}% less</b></> : null}.
                </Brief>
                <Brief>
                  With <b>{annualFreq} shipment{annualFreq === 1 ? '' : 's'} a year</b> on this route, that adds up to{' '}
                  <b>{formatTonnes(annualSave)} avoided per year</b>
                  {transitDelta !== 0 && <> · delivery takes {transitDelta > 0 ? `${transitDelta} day${transitDelta === 1 ? '' : 's'} longer` : `${Math.abs(transitDelta)} day${Math.abs(transitDelta) === 1 ? '' : 's'} less`} ({recScenario.slaRisk} service risk)</>}.
                </Brief>
                {lane.airSharePct > 0 && (
                  <Brief>
                    <b>{Math.round(lane.airSharePct)}%</b> of this route&apos;s CO₂e comes from shipments that went by air (plane) — the
                    single quickest improvement is planning early enough to avoid the flight.
                  </Brief>
                )}
              </>
            )}
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled' }}>
            ✦ Computed from this lane&apos;s route options and suggestions — deterministic and reproducible
          </Typography>
        </CardContent>
      </Card>

      {/* Reduction suggestions — right after the brief, simplest possible form.
          Suggestions only: acting on them happens in the customer's own systems. */}
      {!readOnly && suggestions.length > 0 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Reduction suggestions
            </Typography>
            <Chip size="small" label={`${suggestions.length}`} />
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>
            Ranked by impact × confidence — what to change on this route and what it&apos;s worth
          </Typography>
          <Stack spacing={1}>
            {suggestions.map((r, i) => (
              <SuggestionRow key={r.id} rank={i + 1} rec={r} />
            ))}
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1.5 }}>
            The map, route options and leg-by-leg breakdown for this route are in the Control Tower workspace — not repeated here.
          </Typography>
        </Box>
      )}
      {readOnly && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          This shipment is already underway or delivered, so no suggestions are shown here — they apply to to-be-planned bookings only.
        </Typography>
      )}
    </Stack>
  );
}

/** One suggestion in plain English: what to change (modes) and what you get. */
function SuggestionRow({ rank, rec }: { rank: number; rec: Recommendation }) {
  const meta = TYPE_META[rec.type];
  const savesMoney = rec.costImpactUsd <= 0;
  const freight = Math.abs(rec.costImpactUsd);
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main', fontSize: 12, fontWeight: 800 }}>
          {rank}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            {meta && (
              <Tooltip title={meta.desc} arrow>
                <Chip size="small" label={meta.label} sx={{ fontWeight: 700, bgcolor: (t) => alpha(t.palette.primary.main, 0.08), color: 'primary.dark' }} />
              </Tooltip>
            )}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {rec.title}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, mb: 1 }}>
            {rec.rationale}
          </Typography>

          {/* What actually changes — the modes, before and after */}
          <ModePathChange from={rec.fromModePath} to={rec.toModePath} />

          {/* The benefit, in plain words */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            <Chip size="small" color="success" variant="filled" sx={{ fontWeight: 700 }} label={`${formatTonnes(rec.estCo2eSavingTonnes)}/yr less CO₂e · ${rec.estCo2eSavingPct}% cleaner`} />
            <Chip
              size="small"
              variant="outlined"
              color={savesMoney ? 'success' : 'default'}
              label={savesMoney ? `Saves ${formatCurrency(freight)}/yr on freight` : `Costs ${formatCurrency(freight)}/yr more on freight`}
            />
            <Chip size="small" variant="outlined" label={`How confident: ${Math.round(rec.confidence)}%`} />
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function LabelledPlace({ name, label }: { name: string; label: string; big?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap>
        {name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function Brief({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.9, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
        {children}
      </Typography>
    </Stack>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: accent ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
