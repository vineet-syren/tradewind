import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Collapse, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { Recommendation } from '@/types';
import { SavingChip, SourceRef } from '@/components/shared/Chips';
import { ModePathChange } from '@/components/shared/ModePath';
import { TYPE_META } from '@/constants/actionTypes';
import { formatDate } from '@/utils/format';

/** A compact suggestion row — used wherever the full DecisionCard is too tall. */
export function RecommendationCard({ rec, onOpenLane }: { rec: Recommendation; onOpenLane?: () => void }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const meta = TYPE_META[rec.type];

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
              <Tooltip title={meta?.desc ?? ''} arrow>
                <Chip
                  size="small"
                  icon={meta?.icon}
                  label={meta?.label ?? rec.type}
                  sx={{
                    fontWeight: 700,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    color: 'primary.dark',
                    '& .MuiChip-icon': { fontSize: 15, color: 'primary.main' },
                  }}
                />
              </Tooltip>
              {rec.shipmentDate && (
                <Typography variant="caption" color="text.secondary">
                  ships {formatDate(rec.shipmentDate)}
                </Typography>
              )}
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {rec.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {rec.laneLabel} · {rec.category}
            </Typography>
          </Box>
          <SavingChip tonnes={rec.estCo2eSavingTonnes} pct={rec.estCo2eSavingPct} />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1.25 }}>
          {rec.rationale}
        </Typography>

        {/* What actually changes about the journey */}
        <ModePathChange from={rec.fromModePath} to={rec.toModePath} />

        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 1.25 }}>
          <Chip
            size="small"
            variant="outlined"
            color={rec.transitImpactDays > 0 ? 'warning' : 'success'}
            label={
              rec.transitImpactDays === 0
                ? 'Same transit time'
                : `${rec.transitImpactDays > 0 ? '+' : '−'}${Math.abs(rec.transitImpactDays)} days (est.)`
            }
          />
          <Chip size="small" variant="outlined" label={`${rec.complexity} effort`} />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}>
          <Box sx={{ flexGrow: 1 }} />
          {onOpenLane && (
            <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={onOpenLane}>
              Open lane
            </Button>
          )}
        </Stack>

        <Button
          size="small"
          variant="text"
          color="inherit"
          onClick={() => setShowEvidence((v) => !v)}
          endIcon={<ExpandMoreRoundedIcon sx={{ transform: showEvidence ? 'rotate(180deg)' : 'none', transition: '.2s' }} />}
          sx={{ mt: 0.5, color: 'text.secondary' }}
        >
          Why this works
        </Button>
        <Collapse in={showEvidence}>
          <Box sx={{ mt: 0.5, pl: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.55 }}>
              {rec.proof}
            </Typography>
            <Stack spacing={0.5}>
              {rec.evidence.map((ev, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="caption" color="text.secondary">
                    {ev.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'right' }}>
                    {ev.value}
                    {ev.comparison ? ` · ${ev.comparison}` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <SourceRef refs={rec.proofRefs} />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
