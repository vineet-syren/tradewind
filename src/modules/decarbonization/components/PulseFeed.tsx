import { Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { PulseEvent } from '@/types';
import { IntentDot } from '@/components/shared/Chips';
import { formatRelative } from '@/utils/format';
import { APP_TODAY } from '@/constants/app';

export function PulseFeed({ events, max = 8 }: { events: PulseEvent[]; max?: number }) {
  const theme = useTheme();
  const intentColor: Record<string, string> = {
    positive: theme.palette.success.main,
    opportunity: theme.palette.primary.main,
    risk: theme.palette.error.main,
    negative: theme.palette.error.main,
    neutral: theme.palette.text.disabled,
  };
  const nowIso = `${APP_TODAY}T09:00:00Z`;
  return (
    <Stack spacing={1.5}>
      {events.slice(0, max).map((e) => (
        <Stack key={e.id} direction="row" spacing={1.25} alignItems="flex-start">
          <Stack alignItems="center" sx={{ pt: 0.5 }}>
            <IntentDot color={intentColor[e.intent] ?? theme.palette.text.disabled} />
          </Stack>
          <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
              {e.summary}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {e.region} · {formatRelative(e.timestamp, nowIso)}
            </Typography>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
