import type { ReactNode } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { formatTonnes } from '@/utils/format';

export interface HeroPart {
  label: string;
  tonnes: number;
  count: number;
}

/**
 * The one sentence a logistics lead should read first: how much CO₂e is sitting
 * in freight they have not booked yet, and what kind of change would release it.
 *
 * Deliberately states only what the workbook supports — these are re-costings of
 * routes the sheet already records, not projections.
 */
export function ValueHero({
  totalTonnes,
  decisionCount,
  parts,
  asOf,
  emptyMessage,
}: {
  totalTonnes: number;
  decisionCount: number;
  parts: HeroPart[];
  /** The date the app treats as today — the day after the workbook closes. */
  asOf?: string;
  emptyMessage?: string;
}) {
  const A = ({ children }: { children: ReactNode }) => (
    <Box component="span" sx={{ color: '#E7A93B', fontWeight: 800, whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );

  return (
    <Card
      sx={{
        mb: 3,
        color: '#fff',
        border: 0,
        background: 'radial-gradient(120% 140% at 0% 0%, #143240 0%, #0C1E28 55%, #0A1922 100%)',
      }}
    >
      <CardContent sx={{ py: { xs: 3, md: 3.5 }, px: { xs: 2.5, md: 4 } }}>
        <Typography
          sx={{
            fontSize: 11,
            letterSpacing: '0.16em',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
          }}
        >
          Still to be planned{asOf ? ` · as of ${asOf}` : ''}
        </Typography>

        {decisionCount === 0 ? (
          <Typography sx={{ mt: 1.25, fontWeight: 800, lineHeight: 1.3, fontSize: { xs: '1.4rem', md: '1.8rem' } }}>
            {emptyMessage ?? 'Every shipment ahead is already on the lowest-carbon route your records can prove.'}
          </Typography>
        ) : (
          <>
            <Typography
              sx={{
                mt: 1.25,
                fontWeight: 800,
                lineHeight: 1.25,
                fontSize: { xs: '1.5rem', md: '2rem' },
                textWrap: 'balance',
              }}
            >
              <A>{formatTonnes(totalTonnes)} CO₂e</A> is sitting in{' '}
              <A>
                {decisionCount} shipment{decisionCount === 1 ? '' : 's'}
              </A>{' '}
              you have not booked yet — every alternative below is a route your own workbook has already run.
            </Typography>

            {parts.length > 0 && (
              <Stack direction="row" spacing={3} sx={{ mt: 2.5, flexWrap: 'wrap' }} useFlexGap>
                {parts.map((p) => (
                  <Box key={p.label}>
                    <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.1, color: '#E7A93B' }}>
                      {formatTonnes(p.tonnes)}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
                      {p.label} · {p.count} shipment{p.count === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}

        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.6)', fontSize: '.85rem' }}>
          Bookings stay in your own systems. Tradewind only prices the options — using the distances and emission factors
          from your transport workbook, with the source cell shown against every figure.
        </Typography>
      </CardContent>
    </Card>
  );
}
