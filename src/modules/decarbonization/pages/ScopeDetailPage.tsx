import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import FormatListBulletedRounded from '@mui/icons-material/FormatListBulletedRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScopeTrendArea } from '@/components/charts/ScopeTrendArea';
import { CategoryBreakdownList } from '@/components/charts/CategoryBreakdownList';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import type { KpiMetric, ScopeId } from '@/types';
import { SCOPE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const SCOPE_BY_PATH: Record<string, ScopeId> = { '/scope-1': 'scope1', '/scope-2': 'scope2', '/scope-3': 'scope3' };
const SCOPE_ICON: Record<ScopeId, string> = { scope1: 'fuel', scope2: 'intensity', scope3: 'lanes' };
const SCOPE_OVERLINE: Record<ScopeId, string> = {
  scope1: 'Enterprise · Scope 1 · Direct emissions',
  scope2: 'Enterprise · Scope 2 · Purchased energy',
  scope3: 'Enterprise · Scope 3 · Value chain',
};

export default function ScopeDetailPage() {
  const theme = useTheme();
  const ds = useDataSource();
  const { pathname } = useLocation();
  const scope = SCOPE_BY_PATH[pathname] ?? 'scope1';
  const { data: inv } = useAsync(() => ds.getCarbonInventory(), []);

  const summary = inv?.byScope.find((s) => s.scope === scope);
  const categories = useMemo(
    () => (inv ? [...inv.categories.filter((c) => c.scope === scope)].sort((a, b) => b.co2eTonnes - a.co2eTonnes) : []),
    [inv, scope],
  );
  const relevant = categories.filter((c) => c.relevant);
  const primaryPct = useMemo(() => {
    if (!relevant.length) return 0;
    const tot = relevant.reduce((a, c) => a + c.co2eTonnes, 0);
    const prim = relevant.filter((c) => c.dataQuality === 'primary').reduce((a, c) => a + c.co2eTonnes, 0);
    return Math.round((prim / Math.max(tot, 0.001)) * 100);
  }, [relevant]);

  const kpis: KpiMetric[] | undefined = inv && summary && [
    {
      id: 'total',
      label: `${summary.label.split(' · ')[0]} total`,
      value: summary.co2eTonnes,
      unit: 'tonnes',
      display: `${formatTonnes(summary.co2eTonnes)}/yr`,
      intent: 'neutral',
      icon: SCOPE_ICON[scope],
      deltaPct: summary.deltaPctVsBaseline,
      deltaLabel: `vs ${inv.baselineYear}`,
      betterWhenLower: true,
    },
    { id: 'share', label: 'Share of org footprint', value: summary.pct, unit: 'percent', intent: 'neutral', icon: 'co2e', hint: `${formatTonnes(inv.totalCo2eTonnes)} total` },
    { id: 'sources', label: 'Reported sources', value: summary.categoryCount, unit: 'number', intent: 'neutral', icon: 'concentration', hint: scope === 'scope3' ? 'of 15 GHG Protocol categories' : 'emission sources' },
    { id: 'dq', label: 'Primary-data coverage', value: primaryPct, unit: 'percent', intent: primaryPct >= 50 ? 'positive' : 'neutral', icon: 'green', hint: 'activity-based share' },
  ];

  return (
    <Box>
      <PageHeader
        overline={SCOPE_OVERLINE[scope]}
        title={summary?.label ?? 'Scope'}
        subtitle={summary?.description}
      />

      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => (
              <KpiCard key={m.id} metric={m} />
            ))}
          </Box>
        ) : (
          <KpiSkeleton count={4} />
        )}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' }, mb: 3 }}>
        <ChartContainer
          title={scope === 'scope3' ? 'Scope 3 categories' : 'Emission sources'}
          subtitle="Ranked by CO₂e — dots show data quality"
          icon={<FormatListBulletedRounded sx={{ fontSize: 18 }} />}
        >
          {inv ? <CategoryBreakdownList categories={categories} /> : <ChartSkeleton height={360} />}
        </ChartContainer>

        <Stack spacing={2.5}>
          <ChartContainer title={`Trend since ${inv?.baselineYear ?? 2020}`} subtitle="Annual emissions for this scope" icon={<TimelineRounded sx={{ fontSize: 18 }} />}>
            {inv ? <ScopeTrendArea data={inv.byYear} scope={scope} /> : <ChartSkeleton height={260} />}
          </ChartContainer>

          {scope === 'scope2' && inv && (
            <ChartContainer title="Market vs location-based">
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Market-based</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatTonnes(inv.scope2.marketBasedTonnes)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Location-based</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatTonnes(inv.scope2.locationBasedTonnes)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Renewable electricity</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{inv.scope2.renewablePct}%</Typography>
                </Stack>
              </Stack>
            </ChartContainer>
          )}

          {scope === 'scope3' && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(SCOPE_COLORS.scope3, 0.08),
                border: `1px solid ${alpha(SCOPE_COLORS.scope3, 0.25)}`,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Downstream transport is measured here
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Category 9 is calculated bottom-up from every shipment. Drill into routes, decisions and reduction actions in the Transportation module.
              </Typography>
              <Button
                component={RouterLink}
                to="/control-tower"
                size="small"
                variant="contained"
                endIcon={<ArrowForwardRounded />}
              >
                Open Control Tower
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      {inv && summary && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip label={`${relevant.length} sources`} size="small" sx={{ fontWeight: 600 }} />
            <Chip label={`${summary.deltaPctVsBaseline > 0 ? '+' : ''}${summary.deltaPctVsBaseline}% vs ${inv.baselineYear}`} size="small" color={summary.deltaPctVsBaseline <= 0 ? 'success' : 'error'} sx={{ fontWeight: 600 }} />
            <Typography variant="body2" color="text.secondary">
              {scope === 'scope1' && 'Direct emissions are the most controllable — efficiency, electrification and refrigerant management drive them down.'}
              {scope === 'scope2' && 'Renewable power purchase agreements are the fastest lever on Scope 2.'}
              {scope === 'scope3' && 'Scope 3 is the largest and least-controlled — supplier engagement and modal shift matter most.'}
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
