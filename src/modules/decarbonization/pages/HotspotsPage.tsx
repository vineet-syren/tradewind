import { useMemo, useState } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { EquivalentsStrip } from '@/components/cards/EquivalentsStrip';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarList } from '@/components/charts/BarList';
import { IntensityRanking } from '@/components/charts/IntensityRanking';
import { YearOverYearChart } from '@/components/charts/YearOverYearChart';
import { MoMTrendChart } from '@/components/charts/MoMTrendChart';
import { ModeTrendArea } from '@/components/charts/ModeTrendArea';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { SankeyChart } from '@/components/charts/SankeyChart';
import { ChartSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { HotspotDimension, HotspotRow } from '@/types';
import {
  insightsForFlows,
  insightsForHotspots,
  insightsForModeSplit,
  insightsForMonthlyByMode,
  insightsForMonthlyTimeline,
  insightsForReportingYears,
  insightsForSeasonality,
} from '@/utils/insights';
import { formatTonnes } from '@/utils/format';

const DIMENSIONS: { key: HotspotDimension; label: string; noun: string }[] = [
  { key: 'byCategory', label: 'Product category', noun: 'product category' },
  { key: 'byProduct', label: 'Product', noun: 'product' },
  { key: 'byDestPort', label: 'Destination port', noun: 'destination port' },
  { key: 'byMarket', label: 'Market', noun: 'destination market' },
  { key: 'byGateway', label: 'Gateway port', noun: 'gateway port' },
  { key: 'byMode', label: 'Transport mode', noun: 'transport mode' },
];

/** Chart-shape adapters — the charts speak label/value, the domain speaks CO₂e. */
const toBars = (rows: HotspotRow[]) =>
  rows.map((r) => ({
    label: r.label,
    value: r.co2eTonnes,
    sub: r.shipments ? `${r.shipments} movement${r.shipments === 1 ? '' : 's'}` : undefined,
  }));
const toIntensity = (rows: HotspotRow[]) =>
  [...rows]
    .sort((a, b) => b.co2ePerTonneKm - a.co2ePerTonneKm)
    .map((r) => ({ label: r.label, value: r.co2ePerTonneKm, sub: formatTonnes(r.co2eTonnes) }));

/** Where the footprint actually sits, sliced by every dimension the workbook holds. */
export default function HotspotsPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: hotspots, status } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);
  const { data: evidence } = useAsync(() => ds.getEvidence(), []);
  const [dimension, setDimension] = useState<HotspotDimension>('byCategory');
  const [yearFocus, setYearFocus] = useState<string | null>(null);

  const dim = DIMENSIONS.find((d) => d.key === dimension)!;
  const rows = hotspots?.[dimension] ?? [];
  const collection = hotspots?.byCollectionOrigin ?? [];

  // Clicking a year bar drills the monthly chart into that reporting year.
  const monthlyRows = useMemo(() => {
    const all = evidence?.monthly ?? [];
    if (!yearFocus) return all;
    const year = evidence?.years.find((y) => y.reportingYear === yearFocus);
    if (!year) return all;
    return all.filter((m) => m.period >= year.from.slice(0, 7) && m.period <= year.to.slice(0, 7));
  }, [evidence, yearFocus]);

  const kpis = useMemo(() => {
    if (!footprint) return [];
    return [
      {
        id: 'total',
        label: 'CO₂e in scope',
        value: footprint.totalCo2eTonnes,
        unit: 'tonnes' as const,
        intent: 'neutral' as const,
        hint: `${footprint.shipmentCount} movements`,
        icon: 'co2e',
      },
      {
        id: 'avoidable',
        label: 'Avoidable on optimised routes',
        value: footprint.avoidableTonnes,
        unit: 'tonnes' as const,
        intent: 'opportunity' as const,
        hint: `${footprint.avoidablePct}% of scope`,
        icon: 'decisioning',
      },
      {
        id: 'road',
        label: 'Road legs',
        value: footprint.roadCo2eTonnes,
        unit: 'tonnes' as const,
        intent: 'risk' as const,
        hint: 'charged per truck run',
        icon: 'carrier',
      },
      {
        id: 'intensity',
        label: 'Intensity',
        value: footprint.avgIntensity,
        unit: 'intensity' as const,
        intent: 'neutral' as const,
        hint: 'g CO₂e per tonne-km',
        icon: 'lanes',
      },
    ];
  }, [footprint]);

  return (
    <Box>
      <PageHeader
        overline="Understand · where the carbon sits"
        title="Emission Hotspots"
        subtitle="The same CO₂e, sliced every way the workbook supports — product, port, gateway, market and mode, over time."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {kpis.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}>
          {kpis.map((k) => (
            <KpiCard key={k.id} metric={k} />
          ))}
        </Box>
      )}

      {status === 'loading' || !hotspots ? (
        <ChartSkeleton height={420} />
      ) : !rows.length ? (
        <Card>
          <EmptyState
            icon={<LocalFireDepartmentRounded sx={{ fontSize: 44 }} />}
            title="Nothing in scope"
            description="No movements match the current filters. Clear one and the rankings will come back."
          />
        </Card>
      ) : (
        <Stack spacing={3}>
          {/* Trajectory first: total vs efficiency, then drill to months */}
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <ChartContainer
              title="Year over year"
              subtitle="Bars are total CO₂e, the line is intensity — click a year to drill into its months"
              icon={<ShowChartRounded sx={{ fontSize: 18 }} />}
              insights={footprint ? insightsForReportingYears(footprint.byReportingYear) : undefined}
              isEmpty={Boolean(footprint && footprint.byReportingYear.length === 0)}
              emptyMessage="No reporting year falls inside the current filters. Widen the date range and the yearly trend comes back."
            >
              {footprint ? (
                // Every year in scope, including the one still being planned —
                // the chart marks those rather than dropping them, which is what
                // used to leave this card blank under a forward-book filter.
                <YearOverYearChart
                  data={footprint.byReportingYear}
                  onYearClick={(y) => setYearFocus((cur) => (cur === y ? null : y))}
                  height={280}
                />
              ) : (
                <ChartSkeleton height={280} />
              )}
            </ChartContainer>

            <ChartContainer
              title={yearFocus ? `Month by month · ${yearFocus}` : 'Month by month'}
              subtitle={
                yearFocus
                  ? 'Click the same year bar again to show every month'
                  : 'Every month on the timeline · drag the brush below to zoom into a stretch'
              }
              icon={<ShowChartRounded sx={{ fontSize: 18 }} />}
              insights={evidence ? insightsForMonthlyTimeline(monthlyRows) : undefined}
              isEmpty={Boolean(evidence && monthlyRows.length === 0)}
              emptyMessage="No months fall inside the current selection."
            >
              {evidence ? (
                <MoMTrendChart
                  data={monthlyRows.map((m) => ({ label: m.period, value: m.co2eTonnes, dataOrigin: m.dataOrigin }))}
                  height={280}
                />
              ) : (
                <ChartSkeleton height={280} />
              )}
            </ChartContainer>
          </Box>

          {/* Self-service ranking — one dimension picker over the whole width.
              The treemap that used to sit beside this bar list showed the same
              numbers twice; the treemap lives on Product & Destination Lanes,
              which is the page built around composition. */}
          <ChartContainer
            title={`CO₂e by ${dim.noun}`}
            subtitle="Ranked highest first · switch the dimension to re-slice the same emissions"
            icon={<LayersRounded sx={{ fontSize: 18 }} />}
            insights={insightsForHotspots(rows, dim.noun)}
            action={
              <TextField
                select
                size="small"
                label="Slice by"
                value={dimension}
                onChange={(e) => setDimension(e.target.value as HotspotDimension)}
                sx={{ width: 220 }}
              >
                {DIMENSIONS.map((d) => (
                  <MenuItem key={d.key} value={d.key}>
                    {d.label}
                  </MenuItem>
                ))}
              </TextField>
            }
          >
            <BarList items={toBars(rows)} valueFormatter={formatTonnes} />
          </ChartContainer>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <ChartContainer
              title="CO₂e by transport mode"
              subtitle="Which mode carries the footprint"
              insights={footprint ? insightsForModeSplit(footprint.modeSplit) : undefined}
            >
              {footprint ? <ModeSplitDonut data={footprint.modeSplit} /> : <ChartSkeleton height={260} />}
            </ChartContainer>

            <ChartContainer
              title="Least efficient per tonne moved"
              subtitle={`g CO₂e per tonne-kilometre by ${dim.noun}`}
              insights={insightsForHotspots(rows, dim.noun)}
            >
              <IntensityRanking items={toIntensity(rows)} avg={footprint?.avgIntensity} />
            </ChartContainer>
          </Box>

          {/* Seasonality had its own heat map here reading the same
              `monthlyByMode` rows as this area chart, so the two said the same
              thing twice; the seasonal reading is folded into these insights.
              "CO₂e by destination region" is covered in full by Region × mode on
              Product & Destination Lanes, which shows the mix as well as the total. */}
          <ChartContainer
            title="Monthly CO₂e by mode"
            subtitle="Where the seasonal peaks fall, and which mode drives them · drag the brush to zoom"
            icon={<ShowChartRounded sx={{ fontSize: 18 }} />}
            insights={[...insightsForMonthlyByMode(hotspots.monthlyByMode), ...insightsForSeasonality(hotspots.monthlyByMode)]}
            isEmpty={hotspots.monthlyByMode.length === 0}
          >
            <ModeTrendArea data={hotspots.monthlyByMode} />
          </ChartContainer>

          <ChartContainer
            title="Gateway → mode → region"
            subtitle="How the CO₂e flows out of India and where it ends up"
            icon={<AccountTreeRounded sx={{ fontSize: 18 }} />}
            insights={insightsForFlows(hotspots.flows)}
          >
            <SankeyChart flows={hotspots.flows} />
          </ChartContainer>

          {footprint && <EquivalentsStrip tonnes={footprint.totalCo2eTonnes} />}

          {/* First-mile collection is inbound raw material — in the total, but not
              something a route decision can change, so it sits on its own. */}
          {collection.length > 0 && (
            <ChartContainer
              title="First-mile collection"
              subtitle="Road runs bringing raw chilli in from the growing regions — part of the reported total, separate from the export chain"
              insights={insightsForHotspots(collection, 'growing region')}
            >
              <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <BarList items={toBars(collection)} valueFormatter={formatTonnes} color="#f59e0b" />
                <Card variant="outlined" sx={{ boxShadow: 'none' }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Why this is listed apart
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      These runs move raw chilli from the growing regions into the factory and collection stores. They belong in
                      the reported footprint — {formatTonnes(collection.reduce((s, r) => s + r.co2eTonnes, 0))} across{' '}
                      {collection.reduce((s, r) => s + r.shipments, 0)} monthly movements — but no gateway or sailing decision
                      changes them, so they are kept out of the route suggestions.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </ChartContainer>
          )}
        </Stack>
      )}
    </Box>
  );
}

