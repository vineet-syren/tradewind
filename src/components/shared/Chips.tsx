import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ChipProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import { MODE_COLORS, OPTION_COLORS, STATUS_LABEL } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import type { Severity } from '@/types';
import { formatTonnes } from '@/utils/format';

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

/** Which route option this is — coloured to match its trace on the map. */
export function OptionChip({ kind, label, size = 'small' }: { kind: string; label: string; size?: ChipProps['size'] }) {
  const color = OPTION_COLORS[kind] ?? '#6B7384';
  return (
    <Chip
      size={size}
      label={label}
      sx={{ color, bgcolor: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.32)}`, fontWeight: 700 }}
    />
  );
}

/** The headline number on a decision: how much CO₂e it saves. */
export function SavingChip({ tonnes, pct, size = 'small' }: { tonnes: number; pct?: number; size?: ChipProps['size'] }) {
  return (
    <Chip
      size={size}
      icon={<TrendingDownRoundedIcon sx={{ fontSize: 16, color: 'inherit !important' }} />}
      label={`${formatTonnes(tonnes)} saved${pct !== undefined ? ` · ${Math.round(pct)}%` : ''}`}
      sx={{
        color: 'success.dark',
        bgcolor: (t) => alpha(t.palette.success.main, 0.14),
        border: (t) => `1px solid ${alpha(t.palette.success.main, 0.35)}`,
        fontWeight: 800,
      }}
    />
  );
}

/** Shipped vs still to be planned — the only status the workbook can support. */
export function StatusChip({ status, size = 'small' }: { status: string; size?: ChipProps['size'] }) {
  const open = status === 'Planned';
  return (
    <Chip
      size={size}
      variant={open ? 'filled' : 'outlined'}
      label={STATUS_LABEL[status] ?? status}
      sx={
        open
          ? {
              fontWeight: 700,
              color: 'primary.dark',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.32)}`,
            }
          : { color: 'text.secondary' }
      }
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

/**
 * A workbook cell reference, e.g. "2022-2024!AM12:AX12". Shown wherever a number
 * needs to be checkable at source — the whole point of the app is that it can be.
 */
export function SourceRef({ refs, label = 'Workbook' }: { refs: string[]; label?: string }) {
  const shown = refs.filter(Boolean).slice(0, 3);
  if (!shown.length) return null;
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: 'text.disabled',
        fontFamily: 'monospace',
        fontSize: 10.5,
        mt: 0.5,
        wordBreak: 'break-all',
      }}
    >
      {label}: {shown.join(' · ')}
      {refs.length > shown.length ? ` +${refs.length - shown.length} more` : ''}
    </Typography>
  );
}
