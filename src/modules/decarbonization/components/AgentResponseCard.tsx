import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { Button } from '@mui/material';
import type { CopilotAction, CopilotResult } from '@/types';
import { CopilotViewRenderer } from './CopilotViewRenderer';
import { formatTonnes } from '@/utils/format';

const INTENT_COLOR = {
  positive: 'success.main',
  opportunity: 'primary.main',
  risk: 'error.main',
  negative: 'error.main',
  neutral: 'text.secondary',
} as const;

export function AgentResponseCard({
  result,
  onExecuteAction,
  onOpenLane,
  onExecuteRec,
  onFollowup,
}: {
  result: CopilotResult;
  onExecuteAction?: (a: CopilotAction) => void;
  onOpenLane?: (laneId: string) => void;
  onExecuteRec?: (recId: string) => void;
  onFollowup?: (prompt: string) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AutoAwesomeRoundedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {result.headline}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          {result.answer}
        </Typography>

        {result.insights.length > 0 && (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mb: 2 }}>
            {result.insights.map((ins, i) => (
              <Box key={i} sx={{ px: 1.25, py: 0.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                  {ins.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: INTENT_COLOR[ins.intent ?? 'neutral'] }}>
                  {ins.value}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {result.view.kind !== 'none' && (
          <Box sx={{ mb: 2 }}>
            <CopilotViewRenderer view={result.view} onOpenLane={onOpenLane} onExecuteRec={onExecuteRec} />
          </Box>
        )}

        {result.actions.length > 0 && (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mb: 1 }}>
            {result.actions.map((a) => (
              <Button key={a.id} size="small" variant="contained" startIcon={<BoltRoundedIcon />} onClick={() => onExecuteAction?.(a)}>
                {a.label}
                {a.savingTonnes ? ` (−${formatTonnes(a.savingTonnes)}/yr)` : ''}
              </Button>
            ))}
          </Stack>
        )}

        {result.followups.length > 0 && (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 1 }}>
            {result.followups.map((f) => (
              <Chip key={f} label={f} size="small" variant="outlined" onClick={() => onFollowup?.(f)} sx={{ cursor: 'pointer' }} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
