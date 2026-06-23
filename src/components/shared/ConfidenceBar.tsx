import { Box, LinearProgress, Stack, Typography } from '@mui/material';

/** A compact labelled confidence/feasibility meter (0–100). */
export function ConfidenceBar({ value, label = 'Confidence' }: { value: number; label?: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 130, flexGrow: 1 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {Math.round(value)}%
        </Typography>
      </Stack>
      <Box>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, value))}
          color={value >= 80 ? 'success' : value >= 60 ? 'primary' : 'warning'}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>
    </Stack>
  );
}
