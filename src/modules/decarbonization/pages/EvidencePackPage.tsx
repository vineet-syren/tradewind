import { Box, Card, CardContent, Chip, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { MoMTrendChart } from '@/components/charts/MoMTrendChart';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartSkeleton } from '@/components/loaders/Skeletons';
import { SeverityChip, SourceRef } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { insightsForMonthlyTrend, insightsForReportingYears } from '@/utils/insights';
import { formatDate, formatIntensity, formatNumber, formatPercent, formatTonnes } from '@/utils/format';
import type { ReconciliationStep } from '@/types';

/**
 * The reporting surface: what Tradewind reports, how it ties back to the total
 * the workbook itself prints, the methodology behind it, and the rows in the
 * source data that need fixing.
 */
export default function EvidencePackPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const { data: evidence } = useAsync(() => ds.getEvidence(), []);
  const { data: factors } = useAsync(() => ds.getEmissionFactors(), []);
  const { data: assumptions } = useAsync(() => ds.getAssumptions(), []);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona }), [persona]);
  const { data: exceptions } = useAsync(() => ds.getExceptions(), []);

  if (!evidence || !assumptions) return <ChartSkeleton height={480} />;

  const latest = evidence.years.at(-1)!;
  const baseline = evidence.years[0];
  const dataIssues = (exceptions ?? []).filter((e) => e.kind === 'data-quality');
  const cut = evidence.changeSinceBaselinePct < 0;

  return (
    <Box>
      <PageHeader
        overline="Report · Scope 3 downstream transportation"
        title="Footprint &amp; Evidence"
        subtitle={`Everything here comes from ${evidence.workbook}. Each reporting year is tied line by line to the total the workbook prints for that tab.`}
        actions={<ScopeNote showFilters={false} />}
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}>
        <KpiCard
          metric={{
            id: 'latest',
            label: `CO₂e · ${latest.reportingYear}`,
            value: latest.allLegsCo2eTonnes,
            unit: 'tonnes',
            intent: 'neutral',
            hint: `${latest.shipments} movements · ${formatDate(latest.from)} – ${formatDate(latest.to)}`,
            icon: 'co2e',
          }}
        />
        <KpiCard
          metric={{
            id: 'change',
            label: `Change since ${baseline.reportingYear}`,
            value: evidence.changeSinceBaselinePct,
            unit: 'percent',
            display: formatPercent(evidence.changeSinceBaselinePct, 1),
            intent: cut ? 'positive' : 'risk',
            hint: `${formatTonnes(baseline.allLegsCo2eTonnes)} → ${formatTonnes(latest.allLegsCo2eTonnes)}`,
            icon: 'evidence',
          }}
        />
        <KpiCard
          metric={{
            id: 'intensity',
            label: 'Intensity',
            value: latest.intensity,
            unit: 'intensity',
            intent: 'neutral',
            hint: `against ${formatIntensity(baseline.intensity)} in the baseline year`,
            icon: 'lanes',
          }}
        />
        <KpiCard
          metric={{
            id: 'avoidable',
            label: 'Avoidable on proven routes',
            value: footprint?.avoidableTonnes ?? 0,
            unit: 'tonnes',
            intent: 'opportunity',
            hint: 're-costed on routings the workbook records',
            icon: 'decisioning',
          }}
        />
      </Box>

      <Stack spacing={3}>
        {/* The audit bridge — the single most important thing on this page */}
        <ChartContainer
          title="Reconciliation to the workbook"
          subtitle="From the total each tab prints, to the total Tradewind reports — every line read from the sheet"
          icon={<FactCheckRounded sx={{ fontSize: 18 }} />}
        >
          <Stack spacing={2.5}>
            {evidence.years.map((y) => (
              <Box key={y.reportingYear}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }} useFlexGap>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {y.reportingYear}
                  </Typography>
                  <Chip size="small" variant="outlined" label={`tab ${y.tab}`} sx={{ fontFamily: 'monospace' }} />
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(y.from)} – {formatDate(y.to)} · {y.shipments} movements
                  </Typography>
                  {y.reconciliationNote === null ? (
                    <Chip
                      size="small"
                      icon={<CheckCircleRoundedIcon sx={{ fontSize: 15, color: 'inherit !important' }} />}
                      label="Ties exactly"
                      sx={{ ml: 'auto', fontWeight: 700, color: 'success.dark', bgcolor: (t) => alpha(t.palette.success.main, 0.14) }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      icon={<InfoRoundedIcon sx={{ fontSize: 15, color: 'inherit !important' }} />}
                      label="Bridged below"
                      sx={{ ml: 'auto', fontWeight: 700, color: 'warning.dark', bgcolor: (t) => alpha(t.palette.warning.main, 0.16) }}
                    />
                  )}
                </Stack>
                <BridgeTable steps={y.reconciliation} />
                {y.reconciliationNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, lineHeight: 1.55 }}>
                    {y.reconciliationNote}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </ChartContainer>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
          <ChartContainer
            title="Reported footprint by year"
            subtitle="The workbook's own Jul–Jun reporting windows"
            insights={footprint ? insightsForReportingYears(footprint.byReportingYear) : undefined}
          >
            <MoMTrendChart
              data={evidence.years.map((y) => ({ label: y.reportingYear, value: y.allLegsCo2eTonnes }))}
              height={260}
              zoomable={false}
            />
          </ChartContainer>

          <ChartContainer
            title="Monthly CO₂e"
            subtitle="Every month the workbook covers"
            insights={insightsForMonthlyTrend(evidence.monthly)}
          >
            <MoMTrendChart
              data={evidence.monthly.map((m) => ({ label: m.period, value: m.co2eTonnes }))}
              height={260}
            />
          </ChartContainer>
        </Box>

        {/* Emission factors, with the basis spelled out */}
        <ChartContainer title="Emission factors" subtitle="As stated in the workbook — the basis is what matters most">
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Factor</TableCell>
                  <TableCell>Charged</TableCell>
                  <TableCell>What that means</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(factors ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{f.mode}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {f.value} <Box component="span" sx={{ color: 'text.secondary', fontSize: 11 }}>{f.unit}</Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={f.basis === 'per-truck-km' ? 'warning' : 'default'}
                        label={f.basis === 'per-truck-km' ? 'per truck run' : 'per tonne carried'}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>
                      {f.note}
                      <SourceRef refs={[f.sourceRef]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </ChartContainer>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
          {/* Methodology */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Methodology
              </Typography>
              <Stack spacing={1.25}>
                <Fact label="Calculation" value={evidence.methodology.formula} />
                <Fact label="Road basis" value={evidence.methodology.roadBasis} />
                <Fact label="Factors" value={evidence.methodology.factors} />
                <Fact label="Distances" value={evidence.methodology.distance} />
                <Fact label="Boundary" value={evidence.methodology.boundary} />
                <Fact label="Scope" value={evidence.methodology.scope} />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                The workbook's own data-source notes
              </Typography>
              <Stack spacing={0.5}>
                {evidence.dataSourceNotes.map((n, i) => (
                  <Typography key={i} variant="caption" color="text.secondary">
                    {n}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* What is NOT in the workbook — stated up front rather than implied */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                What this data does not contain
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Tradewind shows no dimension the workbook has no column for, so nothing on any screen is inferred about these.
              </Typography>
              <Stack spacing={1}>
                {assumptions.notInWorkbook.map((n, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'text.disabled', mt: 0.9, flexShrink: 0 }} />
                    <Typography variant="body2" color="text.secondary">
                      {n}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Stated assumptions
              </Typography>
              <Stack spacing={1}>
                {evidence.assumptions.map((a, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.9, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                      {a}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Data-quality findings — things to fix in the source */}
        {dataIssues.length > 0 && (
          <ChartContainer
            title="Rows to fix in the source workbook"
            subtitle="Found while rebuilding the shipments — each one is a place the sheet contradicts itself"
          >
            <Stack spacing={1.5}>
              {dataIssues.map((e) => (
                <Box key={e.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <SeverityChip severity={e.severity} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {e.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {e.laneLabel}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {e.detail}
                  </Typography>
                  <SourceRef refs={[e.sourceRef]} />
                </Box>
              ))}
            </Stack>
          </ChartContainer>
        )}

        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Source: <b>{evidence.workbook}</b> — {evidence.workbookTitle}. Data covers{' '}
              {formatDate(assumptions.dataFrom)} to {formatDate(assumptions.dataTo)} across{' '}
              {assumptions.reportingYears.length} reporting years, {formatNumber(footprint?.shipmentCount ?? 0)} movements
              in the current scope. The app treats {formatDate(assumptions.asOf)} as today — the day after the workbook closes.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

/** The bridge as a signed running total, so it can be checked by eye. */
function BridgeTable({ steps }: { steps: ReconciliationStep[] }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableBody>
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            const first = i === 0;
            const signed = !first && !last;
            return (
              <TableRow key={s.label} sx={last ? { '& td': { borderBottom: 0, borderTop: 2, borderTopStyle: 'solid', borderTopColor: 'divider' } } : undefined}>
                <TableCell sx={{ width: '55%' }}>
                  <Typography variant="body2" sx={{ fontWeight: last || first ? 700 : 500 }}>
                    {s.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                    {s.note}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: last ? 800 : 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: signed ? (s.co2eTonnes < 0 ? 'error.main' : 'warning.dark') : 'text.primary',
                    }}
                  >
                    {signed && s.co2eTonnes > 0 ? '+' : ''}
                    {s.co2eTonnes.toFixed(3)} t
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5, color: 'text.secondary', display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {value}
      </Typography>
    </Box>
  );
}
