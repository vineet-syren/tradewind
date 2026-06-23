import { Box, Stack, Typography } from '@mui/material';

/** Tradewind wordmark with a wind/current glyph. */
export function BrandMark({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const text = dark ? '#FFFFFF' : 'text.primary';
  const sub = dark ? 'rgba(255,255,255,0.55)' : 'text.secondary';
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: 30, height: 30, flexShrink: 0 }}
        aria-hidden
      >
        <rect width="64" height="64" rx="14" fill="#0B1F2A" />
        <path d="M12 24 q10 -8 20 0 t20 0" fill="none" stroke="#2FB8A6" strokeWidth="4" strokeLinecap="round" />
        <path d="M12 34 q10 -8 20 0 t20 0" fill="none" stroke="#0C8B7B" strokeWidth="4" strokeLinecap="round" />
        <path d="M12 44 q10 -8 20 0 t20 0" fill="none" stroke="#15705F" strokeWidth="4" strokeLinecap="round" />
      </Box>
      {!compact && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: text, fontSize: 17 }}>
            Tradewind
          </Typography>
          <Typography sx={{ color: sub, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Carbon Decisioning
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
