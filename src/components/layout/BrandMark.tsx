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
        <rect width="64" height="64" rx="9" fill="#0B1F2A" />
        {/* chilli stem */}
        <path d="M41 20 C 39 13, 32 11, 27 16" fill="none" stroke="#3FA34D" strokeWidth="4.5" strokeLinecap="round" />
        {/* chilli body */}
        <path
          d="M41 20 C 50 27, 48 43, 34 49 C 24 53, 15 49, 17 41 C 22 46, 31 45, 35 36 C 38 29, 36 23, 41 20 Z"
          fill="#E5392A"
        />
        {/* highlight */}
        <path d="M40 24 C 44 29, 43 38, 36 43" fill="none" stroke="#FF7A6B" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
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
