import { Box, Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { ModeLabel } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';

/** A transport-mode chain as icon + name hops, e.g. Road › Ocean › Road. */
function Chain({ modes }: { modes: ModeLabel[] }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      {modes.map((m, i) => (
        <Stack key={i} direction="row" spacing={0.4} alignItems="center">
          <ModeIcon mode={m} sx={{ fontSize: 16, color: MODE_COLORS[m] }} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {m}
          </Typography>
          {i < modes.length - 1 && (
            <Box component="span" sx={{ color: 'text.disabled', fontSize: 12, px: 0.25 }}>
              ›
            </Box>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * "Now → Change to" — the current transport modes vs the suggested modes, so
 * a non-specialist can instantly see what actually changes about the route.
 */
export function ModePathChange({ from, to }: { from?: ModeLabel[]; to?: ModeLabel[] }) {
  if (!from?.length || !to?.length) return null;
  const same = from.join('|') === to.join('|');
  return (
    <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, display: 'block' }}>
            Now
          </Typography>
          <Chain modes={from} />
        </Box>
        <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: 'primary.main', display: { xs: 'none', sm: 'block' } }} />
        <Box>
          <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, display: 'block', fontWeight: 700 }}>
            {same ? 'Keep modes, change route' : 'Change to'}
          </Typography>
          <Chain modes={to} />
        </Box>
      </Stack>
    </Box>
  );
}
