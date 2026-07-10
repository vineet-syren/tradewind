import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { Recommendation } from '@/types';
import { ApproachChip } from '@/components/shared/Chips';
import { ConfidenceBar } from '@/components/shared/ConfidenceBar';
import { ModePathChange } from '@/components/shared/ModePath';
import { TYPE_META } from '@/constants/actionTypes';
import { formatCurrency, formatTonnes } from '@/utils/format';

export function RecommendationCard({
  rec,
  onOpenLane,
}: {
  rec: Recommendation;
  onOpenLane?: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const saving = rec.costImpactUsd <= 0;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
              <Tooltip title={TYPE_META[rec.type]?.desc ?? ''} arrow>
                <Chip
                  size="small"
                  icon={TYPE_META[rec.type]?.icon}
                  label={TYPE_META[rec.type]?.label ?? rec.type}
                  sx={{
                    fontWeight: 700,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    color: 'primary.dark',
                    '& .MuiChip-icon': { fontSize: 15, color: 'primary.main' },
                  }}
                />
              </Tooltip>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
                {rec.agent}
              </Typography>
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {rec.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {rec.laneLabel}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic', mt: 0.25 }}>
              {TYPE_META[rec.type]?.desc}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5}>
            <ApproachChip kind={rec.approach} />
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1.25 }}>
          {rec.rationale}
        </Typography>

        {/* What actually changes — the transport modes, before and after */}
        <ModePathChange from={rec.fromModePath} to={rec.toModePath} />

        {/* The benefit, in plain words */}
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 1.25 }}>
          <Chip size="small" color="success" variant="filled" sx={{ fontWeight: 700 }} label={`${formatTonnes(rec.estCo2eSavingTonnes)}/yr less CO₂e · ${rec.estCo2eSavingPct}% cleaner`} />
          <Chip
            size="small"
            variant="outlined"
            color={saving ? 'success' : 'default'}
            label={saving ? `Saves ${formatCurrency(Math.abs(rec.costImpactUsd))}/yr on freight` : `Costs ${formatCurrency(rec.costImpactUsd)}/yr more on freight`}
          />
          <Chip size="small" variant="outlined" label={`Delivery: ${rec.slaImpact}`} />
          <Chip size="small" variant="outlined" label={`${rec.complexity} effort`} />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
          <ConfidenceBar value={rec.confidence} label="How confident" />
          <Box sx={{ flexGrow: 1 }} />
          {onOpenLane && (
            <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={onOpenLane}>
              Lane 360
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
          Evidence
        </Button>
        <Collapse in={showEvidence}>
          <Stack spacing={0.5} sx={{ mt: 0.5, pl: 1 }}>
            {rec.evidence.map((ev, i) => (
              <Stack key={i} direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {ev.label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {ev.value}
                  {ev.comparison ? ` · ${ev.comparison}` : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
