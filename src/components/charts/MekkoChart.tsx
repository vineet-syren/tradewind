import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { RegionModeRow } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { SwatchLegend } from '@/components/charts/ScatterBubbleChart';
import { formatPercent, formatTonnes } from '@/utils/format';

const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

/** Marimekko — region columns sized by CO₂e share, each 100%-stacked by transport mode. */
export function MekkoChart({
  data,
  height = 320,
  valueFormatter = formatTonnes,
}: {
  data: RegionModeRow[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const grand = data.reduce((s, r) => s + r.total, 0);
  if (grand <= 0 || !data.length) return null;
  const labelBand = 38;

  return (
    <Box
      role="img"
      aria-label={`Marimekko chart: ${data.map((r) => `${r.region} ${formatPercent((r.total / grand) * 100, 0)}`).join(', ')} of ${valueFormatter(grand)}, each stacked by transport mode`}
    >
      <Stack direction="row" alignItems="stretch" spacing="2px" sx={{ height: height - labelBand - 28 }}>
        {data.map((r) => {
          const widthPct = Math.max((r.total / grand) * 100, 4);
          return (
            <Box key={r.region} sx={{ width: `${widthPct}%`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {MODES.filter((m) => r[m] > 0).map((m) => {
                const share = r[m] / r.total;
                return (
                  <Tooltip key={m} title={`${r.region} · ${m}: ${valueFormatter(r[m])} (${formatPercent(share * 100, 0)})`} arrow>
                    <Box
                      sx={{
                        height: `${share * 100}%`,
                        minHeight: 3,
                        bgcolor: MODE_COLORS[m],
                        borderRadius: 0.5,
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                        cursor: 'default',
                      }}
                    >
                      {share > 0.14 && widthPct > 9 && (
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>
                          {formatPercent(share * 100, 0)}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" spacing="2px" sx={{ height: labelBand, mt: 0.5 }}>
        {data.map((r) => {
          const widthPct = Math.max((r.total / grand) * 100, 4);
          return (
            <Tooltip key={r.region} title={`${r.region}: ${valueFormatter(r.total)} (${formatPercent((r.total / grand) * 100, 1)})`} arrow>
              <Box sx={{ width: `${widthPct}%`, overflow: 'hidden', textAlign: 'center', cursor: 'default' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11.5, display: 'block' }} noWrap>
                  {widthPct > 7 ? r.region : '…'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                  {formatPercent((r.total / grand) * 100, 0)}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
      <Box sx={{ mt: 1 }}>
        <SwatchLegend items={MODES.map((m) => ({ color: MODE_COLORS[m], label: m }))} />
      </Box>
    </Box>
  );
}
