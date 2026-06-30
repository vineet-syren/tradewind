import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ForestRoundedIcon from '@mui/icons-material/ForestRounded';
import { formatNumber } from '@/utils/format';

/**
 * Tangible CO₂e equivalents (deck slide 8) so emissions read as real impact.
 * Factors are illustrative US EPA-style annual equivalents.
 */
export function EquivalentsStrip({ tonnes, title = 'In tangible terms' }: { tonnes: number; title?: string }) {
  const items = [
    { icon: <DirectionsCarRoundedIcon />, value: Math.round(tonnes / 4.6), label: 'cars off the road for a year' },
    { icon: <HomeRoundedIcon />, value: Math.round(tonnes / 5.5), label: 'homes’ annual energy use' },
    { icon: <ForestRoundedIcon />, value: Math.round(tonnes / 0.022), label: 'tree-years to absorb' },
  ];
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          {items.map((it) => (
            <Stack key={it.label} direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {it.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.05 }}>
                  ≈ {formatNumber(it.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {it.label}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
