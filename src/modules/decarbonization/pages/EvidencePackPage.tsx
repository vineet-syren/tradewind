import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Divider, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import WaterfallChartRounded from '@mui/icons-material/WaterfallChartRounded';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import TableChartRounded from '@mui/icons-material/TableChartRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ReductionTrendChart } from '@/components/charts/ReductionTrendChart';
import { WaterfallChart, type WaterfallStep } from '@/components/charts/WaterfallChart';
import { KpiCard } from '@/components/cards/KpiCard';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { ChartSkeleton } from '@/components/loaders/Skeletons';
import { SeverityChip, SourceRef } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import {
  insightsForBridge,
  insightsForDataIssues,
  insightsForFactors,
  insightsForMonthlyTrend,
  insightsForReconciliation,
  insightsForYearDetail,
} from '@/utils/insights';
import { buildEsgCsv, downloadTextFile } from '@/utils/reportExport';
import { formatDate, formatIntensity, formatNumber, formatPercent, formatTonnes } from '@/utils/format';
import type { ReconciliationStep, ReportingYearFootprint, YearShare } from '@/types';

/**
 * The reporting surface: what Tradewind reports, how it ties back to the total
 * the workbook itself prints, the methodology behind it, and the rows in the
 * source data that need fixing.
 */
const ALL_YEARS = 'all';

export default function EvidencePackPage() {
  const ds = useDataSource();
  const { data: evidence } = useAsync(() => ds.getEvidence(), []);
  const { data: factors } = useAsync(() => ds.getEmissionFactors(), []);
  const { data: assumptions } = useAsync(() => ds.getAssumptions(), []);
  const { data: exceptions } = useAsync(() => ds.getExceptions(), []);
  // Every persona reports on the same figures — the lens changes emphasis
  // elsewhere in the app, never the reported total — so the year selector is
  // shared and the report is identical whoever is signing it.
  const [yearId, setYearId] = useState<string>(ALL_YEARS);

  if (!evidence || !assumptions) return <ChartSkeleton height={480} />;

  // Recorded reporting years only. A synthetic year can never be selected here:
  // the pack exists to be tied back to the sheet.
  const allYears = evidence.years;
  const scopedYears = yearId === ALL_YEARS ? allYears : allYears.filter((y) => y.reportingYear === yearId);
  const selected = scopedYears.length === 1 ? scopedYears[0] : null;

  const latest = allYears.at(-1)!;
  const baseline = allYears[0];
  const dataIssues = (exceptions ?? []).filter((e) => e.kind === 'data-quality');

  // Headline figures follow the selection, so the KPI row always describes what
  // the rest of the page is showing.
  const head = selected
    ? {
        label: `CO₂e · ${selected.reportingYear}`,
        co2e: selected.allLegsCo2eTonnes,
        intensity: selected.intensity,
        shipments: selected.shipments,
        from: selected.from,
        to: selected.to,
        avoidable: selected.avoidableTonnes,
      }
    : {
        label: `CO₂e · all ${allYears.length} recorded years`,
        co2e: allYears.reduce((s, y) => s + y.allLegsCo2eTonnes, 0),
        intensity: latest.intensity,
        shipments: allYears.reduce((s, y) => s + y.shipments, 0),
        from: baseline.from,
        to: latest.to,
        avoidable: allYears.reduce((s, y) => s + y.avoidableTonnes, 0),
      };

  // Prior year, for the change figure — only meaningful on a single selection.
  const priorYear = selected ? allYears[allYears.indexOf(selected) - 1] : null;
  const changePct = selected
    ? priorYear
      ? ((selected.allLegsCo2eTonnes - priorYear.allLegsCo2eTonnes) / priorYear.allLegsCo2eTonnes) * 100
      : null
    : evidence.changeSinceBaselinePct;

  // Chart the year whose bridge actually has adjustments to show.
  const bridgeYear = [...scopedYears].sort((a, b) => b.reconciliation.length - a.reconciliation.length)[0] ?? latest;

  // Months inside the selection, and never a synthetic one — this is the report.
  const reportMonths = evidence.monthly.filter(
    (m) => m.dataOrigin === 'workbook' && scopedYears.some((y) => m.period >= y.from.slice(0, 7) && m.period <= y.to.slice(0, 7)),
  );

  const download = () => {
    downloadTextFile(
      `terova-scope3-transport-${selected ? selected.reportingYear.toLowerCase() : 'all-years'}.csv`,
      buildEsgCsv({ evidence, years: scopedYears, factors: factors ?? [], generatedOn: assumptions.asOf }),
    );
  };

  return (
    <Box>
      <PageHeader
        overline="Report · Scope 3 downstream transportation"
        title="Footprint &amp; Evidence"
        subtitle={`Everything on this page comes from ${evidence.workbook} and nothing else. The synthetic rows that bridge the workbook to today are excluded here in full — only ${evidence.years.map((y) => y.reportingYear).join(', ')} are reportable, and each is tied line by line to the total the workbook prints for that tab.`}
        actions={<ScopeNote showFilters={false} />}
      />

      <ReportScopeBar
        years={allYears}
        value={yearId}
        onChange={setYearId}
        onDownload={download}
        onPrint={() => window.print()}
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}>
        <KpiCard
          metric={{
            id: 'latest',
            label: head.label,
            value: head.co2e,
            unit: 'tonnes',
            intent: 'neutral',
            hint: `${head.shipments} movements · ${formatDate(head.from)} – ${formatDate(head.to)}`,
            icon: 'co2e',
          }}
        />
        <KpiCard
          metric={{
            id: 'change',
            label: selected
              ? priorYear
                ? `Change vs ${priorYear.reportingYear}`
                : 'Change — baseline year'
              : `Change since ${baseline.reportingYear}`,
            value: changePct ?? 0,
            unit: 'percent',
            display: changePct == null ? '—' : formatPercent(changePct, 1),
            intent: changePct == null ? 'neutral' : changePct < 0 ? 'positive' : 'risk',
            hint: selected
              ? priorYear
                ? `${formatTonnes(priorYear.allLegsCo2eTonnes)} → ${formatTonnes(selected.allLegsCo2eTonnes)}`
                : 'nothing recorded before this year'
              : `${formatTonnes(baseline.allLegsCo2eTonnes)} → ${formatTonnes(latest.allLegsCo2eTonnes)}`,
            icon: 'evidence',
          }}
        />
        <KpiCard
          metric={{
            id: 'intensity',
            label: 'Intensity',
            value: head.intensity,
            unit: 'intensity',
            intent: 'neutral',
            hint: selected && priorYear ? `against ${formatIntensity(priorYear.intensity)} the year before` : `against ${formatIntensity(baseline.intensity)} in the baseline year`,
            icon: 'lanes',
          }}
        />
        <KpiCard
          metric={{
            id: 'avoidable',
            label: 'Avoidable on optimised routes',
            value: head.avoidable,
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
          guideKey="reconciliation"
          subtitle="From the total each tab prints, to the total Tradewind reports — every line read from the sheet"
          icon={<FactCheckRounded sx={{ fontSize: 18 }} />}
          insights={insightsForReconciliation(scopedYears)}
        >
          <Stack spacing={2.5}>
            {scopedYears.map((y) => (
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

        {/* The bridge as a waterfall — the same numbers as the table above, read
            left to right. Shown for the year with the most adjustments, since a
            year that ties exactly is just two identical bars. */}
        <ChartContainer
          title={`How ${bridgeYear.reportingYear} bridges to the reported total`}
          guideKey="bridge-waterfall"
          subtitle={
            bridgeYear.reconciliation.length > 2
              ? 'Printed workbook total, the adjustments, and what Tradewind reports'
              : 'This year needs no adjustment — the two totals are the same figure'
          }
          icon={<WaterfallChartRounded sx={{ fontSize: 18 }} />}
          insights={insightsForBridge(bridgeYear)}
        >
          <WaterfallChart data={bridgeSteps(bridgeYear.reconciliation)} height={300} />
        </ChartContainer>

        {/* Where the selected year's CO₂e actually sits. This is the year-wise
            detail the report needs; the trend charts that used to sit here are
            on Emission Hotspots, which is the page built for them. */}
        <ChartContainer
          title={selected ? `${selected.reportingYear} in detail` : 'Every recorded year in detail'}
          guideKey="year-detail"
          subtitle="The same CO₂e split four ways — each figure read straight from the workbook"
          icon={<TableChartRounded sx={{ fontSize: 18 }} />}
          insights={insightsForYearDetail(scopedYears)}
        >
          <Stack spacing={3}>
            {scopedYears.map((y) => (
              <YearBreakdown key={y.reportingYear} year={y} showTitle={scopedYears.length > 1} />
            ))}
          </Stack>
        </ChartContainer>

        <ChartContainer
          title="Actual against the best proven route"
          guideKey="reduction-trend"
          subtitle="The dashed line is the same month re-costed on the lowest-carbon routing the workbook records — the gap is what was avoidable"
          icon={<ShowChartRounded sx={{ fontSize: 18 }} />}
          insights={insightsForMonthlyTrend(reportMonths)}
          isEmpty={reportMonths.length === 0}
        >
          <ReductionTrendChart data={reportMonths} height={280} />
        </ChartContainer>

        {/* Emission factors, with the basis spelled out */}
        <ChartContainer
          title="Emission factors"
          guideKey="emission-factors"
          subtitle="As stated in the workbook — the basis is what matters most"
          insights={insightsForFactors(factors ?? [])}
        >
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

        {/* `alignItems: start` so each card sizes to its own text. Stretching
            them to match left ~400px of nothing under the shorter one. */}
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
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
            guideKey="data-issues"
            subtitle="Found while rebuilding the shipments — each one is a place the sheet contradicts itself"
            insights={insightsForDataIssues(dataIssues)}
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

        <EquivalentsStrip tonnes={latest.allLegsCo2eTonnes} title={`What ${latest.reportingYear} amounts to`} />

        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Source: <b>{evidence.workbook}</b> — {evidence.workbookTitle}. Data covers{' '}
              {formatDate(assumptions.dataFrom)} to {formatDate(assumptions.dataTo)} across{' '}
              {assumptions.reportingYears.length} recorded reporting years and{' '}
              {formatNumber(allYears.reduce((n, y) => n + y.shipments, 0))} movements. The app treats{' '}
              {formatDate(assumptions.asOf)} as today; the synthetic rows bridging the workbook to that date are excluded
              from this page entirely.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

/**
 * Reporting-year selector and the export actions.
 *
 * Only years the workbook actually records appear here. The synthetic years
 * that bridge the data to today are deliberately absent: this page is the one
 * place in the application whose figures are meant to be quoted, so there is no
 * way to accidentally scope it to a generated year.
 */
function ReportScopeBar({
  years,
  value,
  onChange,
  onDownload,
  onPrint,
}: {
  years: ReportingYearFootprint[];
  value: string;
  onChange: (v: string) => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <Card sx={{ mb: 3, '@media print': { display: 'none' } }}>
      <CardContent sx={{ py: 1.75 }}>
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
          <Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, display: 'block' }}
            >
              Reporting year
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Financial years as the workbook defines them — July to June
            </Typography>
          </Box>

          <TextField
            select
            size="small"
            label="Reporting year"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            sx={{ width: 260 }}
          >
            <MenuItem value={ALL_YEARS}>All recorded years ({years.length})</MenuItem>
            {[...years].reverse().map((y) => (
              <MenuItem key={y.reportingYear} value={y.reportingYear}>
                {y.reportingYear} · {formatDate(y.from)} – {formatDate(y.to)}
              </MenuItem>
            ))}
          </TextField>

          <Chip
            size="small"
            icon={<VerifiedRoundedIcon sx={{ fontSize: 15, color: 'inherit !important' }} />}
            label="Workbook figures only"
            title="No synthetic, modelled or forecast row is included anywhere on this page or in its exports"
            sx={{ fontWeight: 700, color: 'success.dark', bgcolor: (t) => alpha(t.palette.success.main, 0.14) }}
          />

          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button size="small" variant="contained" startIcon={<DownloadRoundedIcon />} onClick={onDownload}>
              Download report (CSV)
            </Button>
            <Button size="small" variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
              Print / save PDF
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** One reporting year split four ways — the year-wise detail the report needs. */
function YearBreakdown({ year, showTitle }: { year: ReportingYearFootprint; showTitle: boolean }) {
  const splits: { title: string; rows: YearShare[] }[] = [
    { title: 'By product category', rows: year.byCategory },
    { title: 'By destination port', rows: year.byDestPort },
    { title: 'By gateway port', rows: year.byGateway },
    { title: 'By transport mode', rows: year.byMode },
  ];
  return (
    <Box>
      {showTitle && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {year.reportingYear}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTonnes(year.allLegsCo2eTonnes)} · {year.shipments} movements · {formatIntensity(year.intensity)}
          </Typography>
        </Stack>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {splits.map((s) => (
          <Box key={s.title} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', px: 1.5, py: 1, bgcolor: 'action.hover' }}>
              {s.title}
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Label</TableCell>
                    <TableCell align="right">CO₂e</TableCell>
                    <TableCell align="right">Share</TableCell>
                    <TableCell align="right">Movements</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.rows.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" noWrap title={r.label}>
                          {r.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatTonnes(r.co2eTonnes)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatPercent(r.pct, 1)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.shipments}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** The same reconciliation, shaped for the waterfall: first is the start, last the end. */
function bridgeSteps(steps: ReconciliationStep[]): WaterfallStep[] {
  return steps.map((s, i) => ({
    label: s.label,
    value: s.co2eTonnes,
    kind: i === 0 ? 'start' : i === steps.length - 1 ? 'end' : 'delta',
  }));
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
