import { useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Snackbar, Stack, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ReductionTrendChart } from '@/components/charts/ReductionTrendChart';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { KpiMetric } from '@/types';
import { formatTonnes } from '@/utils/format';

export default function EvidencePackPage() {
  const ds = useDataSource();
  const decisions = useAppSelector((s) => s.actions.decisions);
  const { data: ev } = useAsync(() => ds.getEvidence(), []);
  const [toast, setToast] = useState<string | null>(null);

  const kpis: KpiMetric[] | undefined = ev && [
    { id: 'base', label: `Baseline ${ev.baselineYear}`, value: ev.baseline.netTonnes, unit: 'tonnes', display: formatTonnes(ev.baseline.netTonnes), intent: 'neutral', hint: 'downstream transport CO₂e' },
    { id: 'latest', label: `Latest ${ev.latestYear} intensity`, value: ev.latest.intensity, unit: 'intensity', intent: 'neutral', hint: `vs ${ev.baseline.intensity} baseline` },
    { id: 'realized', label: 'Realized reduction', value: ev.realizedReductionPct, unit: 'percent', intent: 'positive', hint: 'intensity vs baseline' },
    { id: 'ambition', label: 'Medium-term ambition', value: ev.ambitionPct, unit: 'percent', intent: 'opportunity', hint: '10–20% target' },
  ];

  return (
    <Box>
      <PageHeader
        overline="Act · Evidence & Reporting Agent"
        title="ESG Evidence Pack"
        subtitle="Report-ready, methodology-backed evidence of downstream-transport reduction for ESG and annual-report communication — baseline, realized reductions and the path to the ambition."
        actions={
          <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={() => setToast('Evidence pack exported (mock) — PDF/CSV would download here')}>
            Export pack
          </Button>
        }
      />

      <Box sx={{ mb: 3 }}>{kpis ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
        </Box>
      ) : <KpiSkeleton count={4} />}</Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' } }}>
        <ChartContainer title="Downstream transportation CO₂e" subtitle="Net (after action) vs gross (pre-action); the gap is avoided emissions">
          {ev ? <ReductionTrendChart data={ev.monthly} height={300} /> : <ChartSkeleton height={300} />}
        </ChartContainer>

        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Reduction journey
              </Typography>
              <Stack spacing={1.25}>
                <Journey label={`Baseline (${ev?.baselineYear ?? '—'})`} value={ev ? formatTonnes(ev.baseline.netTonnes) : '—'} />
                <Journey label={`Latest year (${ev?.latestYear ?? '—'})`} value={ev ? formatTonnes(ev.latest.netTonnes) : '—'} />
                <Journey label="Realized intensity reduction" value={ev ? `${ev.realizedReductionPct}%` : '—'} accent />
                <Journey label="Decisions adopted this session" value={`${decisions.length}`} />
                <Journey label="Medium-term ambition" value={ev ? `${ev.ambitionPct}%` : '—'} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                The 10–20% target is a structured journey, not a month-one guarantee — early improvement of ~2% was the realistic start.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {ev && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Methodology
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {ev.methodology.formula}
              </Typography>
            </Box>
            <Stack spacing={1.25}>
              <MethodRow label="Distance" text={ev.methodology.distance} />
              <MethodRow label="Allocation" text={ev.methodology.allocation} />
              <MethodRow label="Emission factors" text={ev.methodology.factors} />
              <MethodRow label="Scope" text={ev.methodology.scope} />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Assumptions
            </Typography>
            <Stack spacing={0.75}>
              {ev.assumptions.map((a, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                  <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'primary.main', mt: 0.25 }} />
                  <Typography variant="body2" color="text.secondary">
                    {a}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Snackbar open={Boolean(toast)} autoHideDuration={3200} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function Journey({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 700, color: accent ? 'success.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function MethodRow({ label, text }: { label: string; text: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'primary.main' }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
}
