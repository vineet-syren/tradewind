import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SnoozeRoundedIcon from '@mui/icons-material/SnoozeRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { Recommendation } from '@/types';
import { ApproachChip, ControllabilityChip } from '@/components/shared/Chips';
import { ConfidenceBar } from '@/components/shared/ConfidenceBar';
import { formatSignedCurrency, formatTonnes } from '@/utils/format';

const TYPE_LABEL: Record<string, string> = {
  'mode-shift': 'Mode shift',
  'route-swap': 'Route optimization',
  'origin-port': 'Origin port',
  'dest-port': 'Destination port',
  consolidation: 'Consolidation',
  'lsp-swap': 'LSP swap',
  'vendor-intervention': 'Vendor governance',
  'air-avoidance': 'Air avoidance',
};

export function RecommendationCard({
  rec,
  executed = false,
  snoozed = false,
  delegate,
  ownerOptions = [],
  onExecute,
  onSnooze,
  onDismiss,
  onAssign,
  onOpenLane,
}: {
  rec: Recommendation;
  executed?: boolean;
  snoozed?: boolean;
  delegate?: string;
  ownerOptions?: string[];
  onExecute?: () => void;
  onSnooze?: () => void;
  onDismiss?: () => void;
  onAssign?: (assignee: string) => void;
  onOpenLane?: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const saving = rec.costImpactUsd <= 0;

  return (
    <Card sx={{ opacity: executed ? 0.65 : 1 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'primary.main' }}>
              {rec.agent} · {TYPE_LABEL[rec.type] ?? rec.type}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {rec.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {rec.laneLabel}
              {delegate && <Chip size="small" label={`→ ${delegate}`} sx={{ ml: 1, height: 18, fontSize: 10 }} />}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5}>
            <ApproachChip kind={rec.approach} />
            {executed && <Chip size="small" color="success" icon={<CheckCircleRoundedIcon />} label="Executed" />}
            {snoozed && !executed && <Chip size="small" variant="outlined" label="Snoozed" />}
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {rec.rationale}
        </Typography>

        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 1.5 }}>
          <Chip size="small" color="primary" variant="filled" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }} label={`−${formatTonnes(rec.estCo2eSavingTonnes)}/yr CO₂e`} />
          <Chip size="small" variant="outlined" label={`up to ${rec.estCo2eSavingPct}%`} />
          <Chip size="small" variant="outlined" color={saving ? 'success' : 'default'} label={`Freight ${formatSignedCurrency(rec.costImpactUsd)}`} />
          <Chip size="small" variant="outlined" label={`SLA: ${rec.slaImpact}`} />
          <ControllabilityChip value={rec.controllability} />
          <Chip size="small" variant="outlined" label={`${rec.complexity} effort`} />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
          <ConfidenceBar value={rec.confidence} />
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {onOpenLane && (
              <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={onOpenLane}>
                Lane 360
              </Button>
            )}
            {onSnooze && !executed && (
              <IconButton size="small" title="Snooze" onClick={onSnooze}>
                <SnoozeRoundedIcon fontSize="small" />
              </IconButton>
            )}
            {onAssign && ownerOptions.length > 0 && !executed && (
              <IconButton size="small" title="Delegate" onClick={(e) => setAnchor(e.currentTarget)}>
                <PersonAddAlt1RoundedIcon fontSize="small" />
              </IconButton>
            )}
            {onDismiss && !executed && (
              <Button size="small" color="inherit" startIcon={<CloseRoundedIcon />} onClick={onDismiss}>
                Dismiss
              </Button>
            )}
            {onExecute && (
              <Button size="small" variant="contained" startIcon={<BoltRoundedIcon />} onClick={onExecute} disabled={executed}>
                {executed ? 'Done' : 'Execute'}
              </Button>
            )}
          </Stack>
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

        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Stack sx={{ p: 1, minWidth: 220, maxHeight: 320, overflowY: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, mb: 0.5 }}>
              Delegate to
            </Typography>
            {ownerOptions.map((o) => (
              <MenuItem
                key={o}
                onClick={() => {
                  onAssign?.(o);
                  setAnchor(null);
                }}
              >
                {o}
              </MenuItem>
            ))}
          </Stack>
        </Popover>
      </CardContent>
    </Card>
  );
}
