import type { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { formatTonnes } from '@/utils/format';

export interface HeroPart {
  label: string;
  tonnes: number;
}

/** A dark "value on the table" banner — the avoidable CO₂e across the network,
 * broken down, so a decision-maker sees what's being missed at a glance. */
export function ValueHero({ totalTonnes, parts, recCount }: { totalTonnes: number; parts: HeroPart[]; recCount: number }) {
  if (totalTonnes <= 0) return null;
  const A = ({ children }: { children: ReactNode }) => (
    <Box component="span" sx={{ color: '#E7A93B', fontWeight: 800, whiteSpace: 'nowrap' }}>{children}</Box>
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
        <Typography sx={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
          Avoidable across the network
        </Typography>
        <Typography sx={{ mt: 1.25, fontWeight: 800, lineHeight: 1.25, fontSize: { xs: '1.5rem', md: '2rem' }, textWrap: 'balance' }}>
          You&rsquo;re leaving <A>{formatTonnes(totalTonnes)} CO₂e/yr</A> in savings on the table
          {parts.length > 0 && <> — </>}
          {parts.map((p, i) => (
            <Box component="span" key={p.label}>
              <A>{formatTonnes(p.tonnes)}</A> in {p.label}
              {i < parts.length - 2 ? ', ' : i === parts.length - 2 ? ', and ' : ''}
            </Box>
          ))}
          .
        </Typography>
        <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.72)', fontSize: '.95rem' }}>
          Realizable this year — <b style={{ color: '#fff' }}>{recCount}</b> ranked actions are ready to capture it in <b style={{ color: '#fff' }}>Reduce &amp; plan</b>.
        </Typography>
      </CardContent>
    </Card>
  );
}
