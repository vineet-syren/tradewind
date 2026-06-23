import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { KpiMetric } from '@/types';
import { formatMetric } from '@/utils/format';

const INTENT_COLOR = {
  positive: 'success.main',
  negative: 'error.main',
  opportunity: 'primary.main',
  risk: 'error.main',
  neutral: 'text.primary',
} as const;

/** A single KPI tile — label, value, and an intent-coloured hint. */
export function KpiCard({ metric }: { metric: KpiMetric }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}
        >
          {metric.label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 1, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {metric.display ?? formatMetric(metric.value, metric.unit)}
        </Typography>
        {metric.hint && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: INTENT_COLOR[metric.intent], lineHeight: 1.35 }}>
              {metric.hint}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
