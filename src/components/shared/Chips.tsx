import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ChipProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MODE_COLORS, APPROACH_COLORS, APPROACH_LABEL } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import type { ApproachKind, Severity } from '@/types';

const SEVERITY_COLOR: Record<Severity, 'error' | 'warning' | 'success'> = {
  High: 'error',
  Medium: 'warning',
  Low: 'success',
};

export function SeverityChip({ severity, size = 'small' }: { severity: Severity; size?: ChipProps['size'] }) {
  return <Chip size={size} color={SEVERITY_COLOR[severity]} variant="outlined" label={severity} />;
}

export function ModeChip({ mode, size = 'small' }: { mode: string; size?: ChipProps['size'] }) {
  const color = MODE_COLORS[mode] ?? '#6B7384';
  return (
    <Chip
      size={size}
      icon={<ModeIcon mode={mode} sx={{ fontSize: 15, color: `${color} !important` }} />}
      label={mode}
      sx={{
        color,
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.3)}`,
        '& .MuiChip-icon': { ml: 0.5 },
      }}
    />
  );
}

export function ApproachChip({ kind, size = 'small' }: { kind: ApproachKind; size?: ChipProps['size'] }) {
  const color = APPROACH_COLORS[kind] ?? '#6B7384';
  return (
    <Chip
      size={size}
      label={APPROACH_LABEL[kind] ?? kind}
      sx={{ color, bgcolor: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.32)}`, fontWeight: 700 }}
    />
  );
}

export function ControllabilityChip({ value, size = 'small' }: { value: string; size?: ChipProps['size'] }) {
  const direct = value.startsWith('Direct');
  return (
    <Chip
      size={size}
      variant="outlined"
      color={direct ? 'primary' : 'default'}
      label={value}
    />
  );
}

/** A coloured dot for intent/severity used inline in lists. */
export function IntentDot({ color }: { color: string }) {
  return <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />;
}

export function ModeLegend() {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
      {Object.keys(MODE_COLORS).map((m) => (
        <Stack key={m} direction="row" spacing={0.5} alignItems="center">
          <ModeIcon mode={m} sx={{ fontSize: 16, color: MODE_COLORS[m] }} />
          <Typography variant="caption" color="text.secondary">
            {m}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
