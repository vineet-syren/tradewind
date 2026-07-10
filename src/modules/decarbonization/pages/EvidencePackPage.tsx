import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Divider, Snackbar, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WaterfallChartRoundedIcon from '@mui/icons-material/WaterfallChartRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ReductionTrendChart } from '@/components/charts/ReductionTrendChart';
import { YearOverYearChart } from '@/components/charts/YearOverYearChart';
import { MoMTrendChart } from '@/components/charts/MoMTrendChart';
import { WaterfallChart, type WaterfallStep } from '@/components/charts/WaterfallChart';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import type { KpiMetric } from '@/types';
import { formatPercent, formatPeriod, formatTonnes } from '@/utils/format';
import { insightsForMonthOverMonth, insightsForReductionTrend, insightsForYearOverYear } from '@/utils/insights';

export default function EvidencePackPage() {
  const ds = useDataSource();
  const { data: ev } = useAsync(() => ds.getEvidence(), []);
  const { data: footprint } = useAsync(() => ds.getFootprint(), []);
  const { data: factors } = useAsync(() => ds.getEmissionFactors(), []);
  const { data: shipRes } = useAsync(() => ds.getShipments({ pageSize: 5000 }), []);
  const [toast, setToast] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<'yoy' | 'mom'>('yoy');
  // Clicking a YoY bar drills into that year's months.
  const [momYear, setMomYear] = useState<number | null>(null);
  // Month-over-month rows — gross monthly inventory tonnes; a drilled year
  // shows exactly that year's months, otherwise the last 18.
  const momRows = useMemo(() => {
    const all = ev?.monthly ?? [];
    const scoped = momYear ? all.filter((m) => m.period.startsWith(String(momYear))) : all.slice(-18);
    return scoped.map((m) => ({ label: formatPeriod(m.period), value: m.grossTonnes }));
  }, [ev, momYear]);
  const drillIntoYear = (year: number) => {
    setMomYear(year);
    setTrendView('mom');
  };

  // Data-quality mix — surfaces how much of the number rests on low-confidence rows.
  const dq = useMemo(() => {
    const items = shipRes?.items ?? [];
    if (!items.length) return undefined;
    const total = items.reduce((s, x) => s + x.co2eTonnes, 0);
    const by = (level: string) => items.filter((x) => x.dataConfidence === level);
    return (['High', 'Medium', 'Low'] as const).map((level) => {
      const rows = by(level);
      const co2e = rows.reduce((s, x) => s + x.co2eTonnes, 0);
      return { level, count: rows.length, sharePct: total > 0 ? (co2e / total) * 100 : 0 };
    });
  }, [shipRes]);

  // Real export: a downloadable JSON pack — methodology, factor snapshot,
  // boundary, series, and the persisted decision ledger.
  const exportPack = () => {
    if (!ev) return;
    const pack = {
      title: 'Terova — Downstream Transportation (Scope 3 Cat 9) Evidence Pack',
      generatedAt: new Date().toISOString(),
      boundary: ev.methodology.scope,
      methodology: ev.methodology,
      assumptions: ev.assumptions,
      emissionFactors: factors ?? 'load emission-factors.json',
      baseline: ev.baseline,
      latest: ev.latest,
      realizedReductionPct: ev.realizedReductionPct,
      ambitionPct: ev.ambitionPct,
      monthlySeries: ev.monthly,
      dataQualityMix: dq,
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terova-evidence-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Evidence pack downloaded — methodology, factor snapshot and monthly series');
  };

  // Emissions bridge: baseline gross → volume growth → efficiency/mode mix → program avoidance → latest net.
  const bridge = useMemo(() => {
    if (!ev) return undefined;
    const baseIntensityPerTonne = ev.baseline.grossTonnes / Math.max(ev.baseline.weightTonnes, 1);
    const volumeEffect = (ev.latest.weightTonnes - ev.baseline.weightTonnes) * baseIntensityPerTonne;
    const efficiencyEffect = ev.latest.grossTonnes - ev.baseline.grossTonnes - volumeEffect;
    const avoided = -(ev.latest.grossTonnes - ev.latest.netTonnes);
    const steps: WaterfallStep[] = [
      { label: `${ev.baselineYear} gross`, value: ev.baseline.grossTonnes, kind: 'start' },
      { label: volumeEffect >= 0 ? 'Volume growth' : 'Volume decline', value: volumeEffect, kind: 'delta' },
      { label: efficiencyEffect <= 0 ? 'Efficiency & mode mix' : 'Intensity drift', value: efficiencyEffect, kind: 'delta' },
      { label: 'Avoided (program)', value: avoided, kind: 'delta' },
      { label: `${ev.latestYear} net`, value: ev.latest.netTonnes, kind: 'end' },
    ];
    const insights = [
      `Shipped volume ${volumeEffect >= 0 ? 'growth added' : 'decline removed'} ${formatTonnes(Math.abs(volumeEffect))} since ${ev.baselineYear} — the largest single driver of the bridge.`,
      `${efficiencyEffect <= 0 ? 'Efficiency and mode mix removed' : 'Intensity drift added'} ${formatTonnes(Math.abs(efficiencyEffect))}, and the reduction program avoided a further ${formatTonnes(Math.abs(avoided))} in ${ev.latestYear}.`,
      `Net result: ${formatTonnes(ev.baseline.grossTonnes)} gross in ${ev.baselineYear} → ${formatTonnes(ev.latest.netTonnes)} net in ${ev.latestYear}, with realized intensity reduction of ${formatPercent(ev.realizedReductionPct, 1)}.`,
    ];
    return { steps, insights };
  }, [ev]);

  const kpis: KpiMetric[] | undefined = ev && [
    { id: 'base', label: `Baseline ${ev.baselineYear} (gross)`, value: ev.baseline.grossTonnes, unit: 'tonnes', display: formatTonnes(ev.baseline.grossTonnes), intent: 'neutral', hint: 'gross inventory basis' },
    { id: 'latest', label: `Latest ${ev.latestYear} intensity`, value: ev.latest.intensity, unit: 'intensity', intent: 'neutral', hint: `vs ${ev.baseline.intensity} baseline` },
    { id: 'realized', label: 'Program-attributed reduction', value: ev.realizedReductionPct, unit: 'percent', intent: 'positive', hint: 'avoided ÷ gross, latest year' },
    { id: 'ambition', label: 'Medium-term ambition', value: ev.ambitionPct, unit: 'percent', intent: 'opportunity', hint: '10–20% target' },
  ];

  return (
    <Box>
      <PageHeader
        overline="Report · Evidence & Reporting Agent"
        title="ESG Reporting"
        subtitle="Report-ready, methodology-backed evidence of downstream-transport reduction for ESG and annual-report communication — baseline, realized reductions and the path to the ambition."
        actions={
          <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={exportPack} disabled={!ev}>
            Export pack
          </Button>
        }
      />

      <Box sx={{ mb: 3 }}>{kpis ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
        </Box>
      ) : <KpiSkeleton count={4} />}</Box>

      {/* Emissions bridge — how the number moved from baseline to latest */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Emissions bridge"
          subtitle={ev ? `${ev.baselineYear} gross → growth, efficiency and program effects → ${ev.latestYear} net` : 'Baseline → drivers → latest net'}
          icon={<WaterfallChartRoundedIcon sx={{ fontSize: 18 }} />}
          insights={bridge?.insights}
        >
          {bridge ? <WaterfallChart data={bridge.steps} height={300} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' } }}>
        <ChartContainer
          title="Downstream transportation CO₂e"
          subtitle="Gross inventory (dashed) vs net after interventions — the gap is the evidenced intervention ledger, never netted into the inventory"
          insights={ev ? insightsForReductionTrend(ev.monthly) : undefined}
        >
          {ev ? <ReductionTrendChart data={ev.monthly} height={300} /> : <ChartSkeleton height={300} />}
        </ChartContainer>

        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Reduction journey
              </Typography>
              <Stack spacing={1.25}>
                <Journey label={`Baseline gross (${ev?.baselineYear ?? '—'})`} value={ev ? formatTonnes(ev.baseline.grossTonnes) : '—'} />
                <Journey label={`Latest year gross (${ev?.latestYear ?? '—'})`} value={ev ? formatTonnes(ev.latest.grossTonnes) : '—'} />
                <Journey label="Program-attributed reduction" value={ev ? `${ev.realizedReductionPct}%` : '—'} accent />
                <Journey label="Medium-term ambition" value={ev ? `${ev.ambitionPct}%` : '—'} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                The 10–20% target is a structured journey, not a month-one guarantee — early improvement of ~2% was the realistic start.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, mt: 3 }}>
        <ChartContainer
          title={trendView === 'yoy' ? 'Year-over-year' : momYear ? `Month-over-month · ${momYear}` : 'Month-over-month'}
          subtitle={trendView === 'yoy' ? 'Total CO₂e (bars) vs intensity (line) · click a year for its months' : undefined}
          insights={trendView === 'yoy' ? (footprint ? insightsForYearOverYear(footprint.byYear) : undefined) : momRows.length ? insightsForMonthOverMonth(momRows) : undefined}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              {trendView === 'mom' && momYear && (
                <Chip size="small" color="primary" variant="outlined" label={`Months of ${momYear}`} onDelete={() => setMomYear(null)} />
              )}
              <ToggleButtonGroup size="small" exclusive value={trendView} onChange={(_, v) => v && setTrendView(v)} sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1.25, textTransform: 'none', fontWeight: 600 } }}>
                <ToggleButton value="yoy">YoY</ToggleButton>
                <ToggleButton value="mom">MoM</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          }
        >
          {trendView === 'yoy' ? (
            footprint ? <YearOverYearChart data={footprint.byYear} height={260} onYearClick={drillIntoYear} /> : <ChartSkeleton height={260} />
          ) : momRows.length ? (
            <MoMTrendChart data={momRows} height={260} />
          ) : (
            <ChartSkeleton height={260} />
          )}
        </ChartContainer>
        {footprint && <EquivalentsStrip tonnes={footprint.annualCo2eTonnes} title={`Annual footprint (${formatTonnes(footprint.annualCo2eTonnes)}/yr) in tangible terms`} />}
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
