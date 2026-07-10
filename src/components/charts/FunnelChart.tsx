import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { chartColor } from '@/app/config/chartColors';
import { formatTonnes } from '@/utils/format';

export interface FunnelStage {
  label: string;
  value: number;
  sub?: string;
}

/** Top-to-bottom funnel — centered bars whose width tracks stage value, with conversion % between stages. */
export function FunnelChart({
  data,
  height = 280,
  valueFormatter = formatTonnes,
}: {
  data: FunnelStage[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0.001);

  return (
    <Stack
      role="img"
      aria-label={`Funnel: ${data.map((d) => `${d.label} ${valueFormatter(d.value)}`).join(' → ')}`}
      justifyContent="center"
      spacing={0.5}
      sx={{ height, py: 1 }}
    >
      {data.map((stage, i) => {
        const widthPct = Math.max((stage.value / max) * 100, 8);
        const conversion = i > 0 && data[i - 1].value > 0 ? (stage.value / data[i - 1].value) * 100 : null;
        const color = chartColor(i);
        return (
          <Box key={stage.label}>
            {conversion != null && (
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', fontSize: 11.5, lineHeight: 1.6 }}>
                ↓ {Math.round(conversion)}%
              </Typography>
            )}
            <Tooltip title={`${stage.label}: ${valueFormatter(stage.value)}${stage.sub ? ` · ${stage.sub}` : ''}`} arrow>
              <Box sx={{ position: 'relative', height: 40, borderRadius: 1.5, bgcolor: alpha(color, 0.08), overflow: 'hidden' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${(100 - widthPct) / 2}%`,
                    width: `${widthPct}%`,
                    bgcolor: color,
                    borderRadius: 1.5,
                  }}
                />
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ position: 'relative', height: '100%', px: 1.5 }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: widthPct > 55 ? '#fff' : 'text.primary' }} noWrap>
                    {stage.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: widthPct > 88 ? '#fff' : 'text.secondary', whiteSpace: 'nowrap' }}>
                    {valueFormatter(stage.value)}
                    {stage.sub ? ` · ${stage.sub}` : ''}
                  </Typography>
                </Stack>
              </Box>
            </Tooltip>
          </Box>
        );
      })}
    </Stack>
  );
}
