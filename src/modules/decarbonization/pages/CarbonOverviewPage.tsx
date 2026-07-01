import { useMemo, useState } from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import DonutLargeRounded from '@mui/icons-material/DonutLargeRounded';
import TimelineRounded from '@mui/icons-material/TimelineRounded';
import FormatListBulletedRounded from '@mui/icons-material/FormatListBulletedRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ScopeDonutChart } from '@/components/charts/ScopeDonutChart';
import { InventoryTrendChart } from '@/components/charts/InventoryTrendChart';
import { CategoryBreakdownList } from '@/components/charts/CategoryBreakdownList';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import type { KpiMetric, ScopeId } from '@/types';
import { SCOPE_COLORS } from '@/constants/app';
import { formatDate, formatTonnes } from '@/utils/format';

type ScopeFilter = 'all' | ScopeId;
const SCOPE_TABS: { key: ScopeFilter; label: string }[] = [
  { key: 'all', label: 'All scopes' },
  { key: 'scope1', label: 'Scope 1' },
  { key: 'scope2', label: 'Scope 2' },
  { key: 'scope3', label: 'Scope 3' },
];

export default function CarbonOverviewPage() {
  const theme = useTheme();
  const ds = useDataSource();
  const { data: inv } = useAsync(() => ds.getCarbonInventory(), []);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  const kpis: KpiMetric[] | undefined = useMemo(() => {
    if (!inv) return undefined;
    const s3 = inv.byScope.find((s) => s.scope === 'scope3');
    return [
      {
        id: 'total',
        label: 'Total carbon footprint',
        value: inv.totalCo2eTonnes,
        unit: 'tonnes',
        display: `${formatTonnes(inv.totalCo2eTonnes)}/yr`,
        intent: 'neutral',
        icon: 'co2e',
        deltaPct: inv.deltaPctVsBaseline,
        deltaLabel: `vs ${inv.baselineYear} baseline`,
        betterWhenLower: true,
      },
      {
        id: 's3share',
        label: 'Scope 3 share',
        value: s3?.pct ?? 0,
        unit: 'percent',
        intent: 'neutral',
        icon: 'lanes',
        hint: 'value-chain emissions',
      },
      {
        id: 'intensity',
        label: 'Carbon intensity',
        value: inv.intensity.perRevenue,
        unit: 'number',
        display: `${inv.intensity.perRevenue} t/$M`,
        intent: 'neutral',
        icon: 'intensity',
        deltaPct: inv.intensity.deltaPct,
        deltaLabel: `vs ${inv.baselineYear}`,
        betterWhenLower: true,
      },
      {
        id: 'target',
        label: `Gap to ${inv.reportingYear} SBTi milestone`,
        value: inv.target.gapTonnes,
        unit: 'tonnes',
        display: `${inv.target.gapTonnes >= 0 ? '+' : ''}${formatTonnes(inv.target.gapTonnes)}`,
        intent: inv.target.onTrack ? 'positive' : 'risk',
        icon: inv.target.onTrack ? 'green' : 'risk',
        hint: inv.target.onTrack ? 'on the reduction path' : 'above the reduction path',
      },
    ];
  }, [inv]);

  const filteredCategories = useMemo(() => {
    if (!inv) return [];
    const cats = scopeFilter === 'all' ? inv.categories : inv.categories.filter((c) => c.scope === scopeFilter);
    return [...cats].sort((a, b) => b.co2eTonnes - a.co2eTonnes);
  }, [inv, scopeFilter]);

  return (
    <Box>
      <PageHeader
        overline="Enterprise · Carbon Inventory"
        title="Carbon Overview"
        subtitle="The whole-company greenhouse-gas footprint — Scope 1, Scope 2 and all 15 Scope 3 categories under the GHG Protocol. Downstream transportation is measured bottom-up in the Transportation module and rolls up here."
        actions={
          inv && (
            <Chip
              icon={<EventAvailableRounded />}
              label={`FY${inv.reportingYear} · as of ${formatDate(inv.asOf)}`}
              variant="outlined"
              size="small"
            />
          )
        }
      />

      {/* Headline KPIs */}
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

      {/* Scope split + trend */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' }, mb: 3 }}>
        <ChartContainer title="Footprint by scope" subtitle="Where the emissions sit across the three GHG Protocol scopes" icon={<DonutLargeRounded sx={{ fontSize: 18 }} />}>
          {inv ? (
            <Box>
              <ScopeDonutChart data={inv.byScope} total={inv.totalCo2eTonnes} />
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {inv.byScope.map((s) => (
                  <Stack key={s.scope} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SCOPE_COLORS[s.scope], flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {s.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatTonnes(s.co2eTonnes)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 42, textAlign: 'right' }}>
                      {s.pct}%
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ) : (
            <ChartSkeleton height={360} />
          )}
        </ChartContainer>

        <ChartContainer title="Emissions vs SBTi target path" subtitle={`Stacked by scope, ${inv?.baselineYear ?? 2020}→now, against the 1.5°C-aligned reduction path`} icon={<TimelineRounded sx={{ fontSize: 18 }} />}>
          {inv ? <InventoryTrendChart data={inv.byYear} /> : <ChartSkeleton height={300} />}
        </ChartContainer>
      </Box>

      {/* Category breakdown */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Emissions by category"
          subtitle="Every relevant emission source, ranked — coloured by scope. Dots show data quality; hover for method."
          icon={<FormatListBulletedRounded sx={{ fontSize: 18 }} />}
          action={
            <Stack direction="row" spacing={0.75}>
              {SCOPE_TABS.map((t) => (
                <Chip
                  key={t.key}
                  label={t.label}
                  size="small"
                  onClick={() => setScopeFilter(t.key)}
                  color={scopeFilter === t.key ? 'primary' : 'default'}
                  variant={scopeFilter === t.key ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          }
        >
          {inv ? (
            <Box>
              <CategoryBreakdownList categories={filteredCategories} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Category 14 (Franchises) is not applicable to Terova’s model and is excluded. Data quality:{' '}
                <Box component="span" sx={{ color: '#2E8B6F', fontWeight: 700 }}>● primary</Box>{' · '}
                <Box component="span" sx={{ color: '#C8841B', fontWeight: 700 }}>● secondary</Box>{' · '}
                <Box component="span" sx={{ color: '#98A0B3', fontWeight: 700 }}>● estimated</Box>.
              </Typography>
            </Box>
          ) : (
            <ChartSkeleton height={420} />
          )}
        </ChartContainer>
      </Box>

      {/* Data quality · Scope 2 dual reporting · Target */}
      {inv && (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <ChartContainer title="Data quality" subtitle="Share of footprint by data grade" icon={<VerifiedRounded sx={{ fontSize: 18 }} />}>
            <Stack spacing={1.75} sx={{ mt: 0.5 }}>
              {([
                ['Primary (activity data)', inv.dataQuality.primaryPct, '#2E8B6F'],
                ['Secondary (supplier/industry)', inv.dataQuality.secondaryPct, '#C8841B'],
                ['Estimated (spend-based)', inv.dataQuality.estimatedPct, '#98A0B3'],
              ] as const).map(([label, pct, color]) => (
                <Box key={label}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{pct}%</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{ height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.06), '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 } }}
                  />
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">
                Priority: replace spend-based Scope 3 estimates (Cat 1) with supplier-specific data.
              </Typography>
            </Stack>
          </ChartContainer>

          <ChartContainer title="Scope 2 reporting" subtitle="Dual reporting per GHG Protocol" icon={<BoltRounded sx={{ fontSize: 18 }} />}>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" color="text.secondary">Market-based</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatTonnes(inv.scope2.marketBasedTonnes)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" color="text.secondary">Location-based</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatTonnes(inv.scope2.locationBasedTonnes)}</Typography>
              </Stack>
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Renewable electricity</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{inv.scope2.renewablePct}%</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={inv.scope2.renewablePct}
                  sx={{ height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.06), '& .MuiLinearProgress-bar': { bgcolor: SCOPE_COLORS.scope2, borderRadius: 999 } }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Renewable contracts cut the market-based figure {formatTonnes(inv.scope2.locationBasedTonnes - inv.scope2.marketBasedTonnes)} below location-based.
              </Typography>
            </Stack>
          </ChartContainer>

          <ChartContainer title="Reduction target" subtitle={inv.target.name} icon={<FlagRounded sx={{ fontSize: 18 }} />}>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <Stack direction="row" spacing={1.5}>
                <TargetStat label={`${inv.target.baseYear} base`} value={formatTonnes(inv.totalBaselineTonnes)} />
                <TargetStat label={`${inv.target.targetYear} target`} value={formatTonnes(inv.target.targetTotalTonnes)} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={`−${inv.target.scope12ReductionPct}% Scope 1+2`} sx={{ fontWeight: 600 }} />
                <Chip size="small" label={`−${inv.target.scope3ReductionPct}% Scope 3`} sx={{ fontWeight: 600 }} />
              </Stack>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(inv.target.onTrack ? theme.palette.success.main : theme.palette.error.main, 0.1),
                  border: `1px solid ${alpha(inv.target.onTrack ? theme.palette.success.main : theme.palette.error.main, 0.3)}`,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: inv.target.onTrack ? 'success.main' : 'error.main' }}>
                  {inv.target.status}
                </Typography>
              </Box>
            </Stack>
          </ChartContainer>
        </Box>
      )}
    </Box>
  );
}

function TargetStat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
}
