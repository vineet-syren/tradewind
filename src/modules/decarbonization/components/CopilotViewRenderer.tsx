import { useState } from 'react';
import { Box, Button, Chip, Collapse, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { CopilotView, Lane, Recommendation } from '@/types';
import { KpiCard } from '@/components/cards/KpiCard';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { ScenarioCompareChart } from '@/components/charts/ScenarioCompareChart';
import { TYPE_META } from '@/constants/actionTypes';
import { APPROACH_LABEL } from '@/constants/app';
import { formatSignedCurrency, formatTonnes, formatIntensity } from '@/utils/format';

const MAX_ROWS = 5;

/**
 * Renders the copilot's attached view. Lists (recommendations, lanes, hotspots)
 * render as compact expand-on-click rows so an answer stays scannable — the
 * headline number is always visible; the detail is one tap away.
 */
export function CopilotViewRenderer({ view, onOpenLane }: { view: CopilotView; onOpenLane?: (laneId: string) => void }) {
  if (view.kind === 'none') return null;

  if (view.kind === 'kpis' && view.kpis)
    return (
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {view.kpis.slice(0, 4).map((m) => (
          <KpiCard key={m.id} metric={m} />
        ))}
      </Box>
    );

  if (view.kind === 'modeSplit' && view.modeSplit)
    return <ModeSplitDonut data={view.modeSplit} />;

  if (view.kind === 'scenario' && view.scenarios)
    return <ScenarioCompareChart scenarios={view.scenarios} height={200} />;

  if (view.kind === 'hotspots' && view.hotspots) {
    const total = view.hotspots.reduce((s, h) => s + h.co2eTonnes, 0);
    return (
      <ExpandableList
        rows={view.hotspots.slice(0, MAX_ROWS).map((h) => ({
          id: h.key,
          title: h.label,
          right: formatTonnes(h.co2eTonnes),
          share: total > 0 ? h.co2eTonnes / total : 0,
          detail: (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={`${h.shipments} shipments`} />
              <Chip size="small" variant="outlined" label={`${formatIntensity(h.co2ePerTonneKm)} intensity`} />
              <Chip size="small" variant="outlined" label={`${total > 0 ? Math.round((h.co2eTonnes / total) * 100) : 0}% of shown`} />
            </Stack>
          ),
        }))}
        moreCount={Math.max(0, view.hotspots.length - MAX_ROWS)}
      />
    );
  }

  if (view.kind === 'lanes' && view.lanes)
    return (
      <ExpandableList
        rows={view.lanes.slice(0, MAX_ROWS).map((l: Lane) => ({
          id: l.laneId,
          title: `${l.origin} → ${l.destPort}`,
          subtitle: l.customer,
          right: `${formatTonnes(l.realizableReductionTonnes)}/yr`,
          rightHint: 'avoidable',
          detail: (
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`${formatTonnes(l.totalCo2eTonnes)} total CO₂e`} />
                <Chip size="small" variant="outlined" label={`${formatIntensity(l.avgCo2ePerTonneKm)} intensity`} />
                <Chip size="small" variant="outlined" color="primary" label={`suggested: ${APPROACH_LABEL[l.recommendedApproach]}`} />
              </Stack>
              {onOpenLane && (
                <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={() => onOpenLane(l.laneId)} sx={{ alignSelf: 'flex-start' }}>
                  Open Lane 360
                </Button>
              )}
            </Stack>
          ),
        }))}
        moreCount={Math.max(0, view.lanes.length - MAX_ROWS)}
      />
    );

  if (view.kind === 'recommendations' && view.recommendations)
    return (
      <ExpandableList
        rows={view.recommendations.slice(0, MAX_ROWS).map((r: Recommendation) => ({
          id: r.id,
          chip: TYPE_META[r.type]?.label,
          title: r.title,
          right: `−${formatTonnes(r.estCo2eSavingTonnes)}/yr`,
          detail: (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {r.rationale}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" color="success" label={`saves ${formatTonnes(r.estCo2eSavingTonnes)}/yr`} />
                <Chip size="small" variant="outlined" label={`freight ${formatSignedCurrency(r.costImpactUsd)}/yr`} />
                <Chip size="small" variant="outlined" label={`${Math.round(r.confidence)}% confidence`} />
              </Stack>
              {onOpenLane && r.laneId && (
                <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={() => onOpenLane(r.laneId!)} sx={{ alignSelf: 'flex-start' }}>
                  Open Lane 360
                </Button>
              )}
            </Stack>
          ),
        }))}
        moreCount={Math.max(0, view.recommendations.length - MAX_ROWS)}
      />
    );

  return null;
}

interface ExpandRow {
  id: string;
  chip?: string;
  title: string;
  subtitle?: string;
  right?: string;
  rightHint?: string;
  share?: number;
  detail: React.ReactNode;
}

/** A tidy list of expand-on-click rows — headline visible, detail one tap away. */
function ExpandableList({ rows, moreCount = 0 }: { rows: ExpandRow[]; moreCount?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Stack spacing={0.75}>
      {rows.map((r) => {
        const isOpen = open === r.id;
        return (
          <Box key={r.id} sx={{ border: 1, borderColor: isOpen ? 'primary.main' : 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              onClick={() => setOpen(isOpen ? null : r.id)}
              sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '.2s', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  {r.chip && <Chip size="small" label={r.chip} sx={{ fontWeight: 700, height: 20, fontSize: 11, bgcolor: (t) => alpha(t.palette.primary.main, 0.08), color: 'primary.dark' }} />}
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {r.title}
                  </Typography>
                </Stack>
                {r.subtitle && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {r.subtitle}
                  </Typography>
                )}
              </Box>
              {r.right && (
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
                    {r.right}
                  </Typography>
                  {r.rightHint && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                      {r.rightHint}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
            <Collapse in={isOpen} unmountOnExit>
              <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, borderTop: 1, borderColor: 'divider' }}>{r.detail}</Box>
            </Collapse>
          </Box>
        );
      })}
      {moreCount > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
          +{moreCount} more — open the matching page from the sidebar for the full list.
        </Typography>
      )}
    </Stack>
  );
}
