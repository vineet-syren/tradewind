import { useMemo } from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { StackedBarTrend } from '@/components/charts/StackedBarTrend';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded';
import FactoryRounded from '@mui/icons-material/FactoryRounded';
import StackedBarChartRounded from '@mui/icons-material/StackedBarChartRounded';
import TipsAndUpdatesRounded from '@mui/icons-material/TipsAndUpdatesRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScopePrompt } from '@/components/filters/ScopePrompt';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { countActiveFilters } from '@/app/store/filtersSlice';
import type { KpiMetric, LspPartner, VendorPartner } from '@/types';
import { formatTonnes } from '@/utils/format';
import { insightsForLsps, insightsForVendors } from '@/utils/insights';

const CONTROL_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

export default function PartnerInfluencePage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // No filters, no data pull — the page waits until the user scopes the view.
  const hasFilters = countActiveFilters(filters) > 0;
  const { data: partners, status } = useAsync(() => (hasFilters ? ds.getPartners({ persona, filters }) : Promise.resolve(null)), [persona, filters]);

  // ── The four numbers a procurement/CSO review actually tracks ────────────
  const carrierTotal = (partners?.lsps ?? []).reduce((s, l) => s + l.co2eTonnes, 0);
  const influenceable = partners ? [...partners.lsps, ...partners.vendors].reduce((s, p) => s + p.influenceableSavingTonnes, 0) : 0;
  const greenShare = partners?.lsps.length
    ? Math.round((partners.lsps.filter((l) => l.greenProgram).reduce((s, l) => s + l.co2eTonnes, 0) / Math.max(carrierTotal, 0.001)) * 100)
    : 0;
  // Fleet intensity weighted by tonnes carried — the "how clean is the panel we
  // actually use" number (1.00 = fleet average).
  const weightedIntensity = partners?.lsps.length
    ? partners.lsps.reduce((s, l) => s + l.intensityIndex * l.co2eTonnes, 0) / Math.max(carrierTotal, 0.001)
    : 1;
  const worstLsp = partners ? [...partners.lsps].sort((a, b) => b.intensityIndex - a.intensityIndex)[0] : undefined;
  const topLsp = partners?.lsps[0];
  const concentration = topLsp && carrierTotal > 0 ? Math.round((topLsp.co2eTonnes / carrierTotal) * 100) : 0;

  const kpis: KpiMetric[] | undefined = !partners ? undefined : [
    { id: 'infl', label: 'Influenceable saving', value: influenceable, unit: 'tonnes', display: `${formatTonnes(influenceable)}/yr`, intent: 'opportunity', icon: 'savings', hint: 'via carrier & vendor levers' },
    { id: 'green', label: 'Green-fleet share', value: greenShare, unit: 'percent', intent: greenShare > 50 ? 'positive' : 'neutral', icon: 'green', hint: 'of carrier CO₂e on certified fleets' },
    { id: 'fleet', label: 'Weighted fleet intensity', value: Math.round((weightedIntensity - 1) * 100), unit: 'percent', display: `${weightedIntensity.toFixed(2)}×`, intent: weightedIntensity > 1.01 ? 'risk' : 'positive', icon: 'carrier', hint: worstLsp ? `worst: ${worstLsp.name}` : undefined },
    { id: 'conc', label: 'Carrier concentration', value: concentration, unit: 'percent', intent: concentration > 40 ? 'risk' : 'neutral', icon: 'concentration', hint: topLsp ? `${topLsp.name} carries the most` : undefined },
  ];

  // ── Carrier mix by year (top 5 carriers + Others) ─────────────────────────
  const trend = useMemo(() => {
    if (!partners?.lspTrend.length) return undefined;
    const top = partners.lsps.slice(0, 5).map((l) => l.name);
    const rows = partners.lspTrend.map((t) => {
      const values: Record<string, number> = {};
      let others = 0;
      for (const [name, v] of Object.entries(t.values)) {
        if (top.includes(name)) values[name] = v;
        else others += v;
      }
      if (others > 0) values.Others = Math.round(others * 100) / 100;
      return { label: String(t.year), values };
    });
    const series = [...top, ...(rows.some((r) => r.values.Others) ? ['Others'] : [])];
    return { rows, series };
  }, [partners]);

  const trendInsights = useMemo(() => {
    if (!partners) return undefined;
    const movers = partners.lsps.filter((l) => l.yoyChangePct != null);
    if (!movers.length) return undefined;
    const riser = [...movers].sort((a, b) => (b.yoyChangePct ?? 0) - (a.yoyChangePct ?? 0))[0];
    const faller = [...movers].sort((a, b) => (a.yoyChangePct ?? 0) - (b.yoyChangePct ?? 0))[0];
    const out = [
      `**${riser.name}** (logistics service provider — the company that moves the freight) grew the fastest year over year: **${riser.yoyChangePct! >= 0 ? '+' : ''}${riser.yoyChangePct}%** CO₂e. If it is not a green-fleet carrier, that growth locks in a dirtier mix.`,
    ];
    if (faller.name !== riser.name)
      out.push(`**${faller.name}** shrank the most (**${faller.yoyChangePct}%**) — check whether that volume moved to a cleaner or dirtier carrier.`);
    return out;
  }, [partners]);

  // ── Holistic "who needs attention" — partner-level, not shipment-level ────
  // Each carrier/vendor is scored on its own standing (footprint, cleanliness,
  // trend, controllability) so the review is about the relationship overall.
  const attention = useMemo(() => {
    if (!partners) return [];
    type Item = { id: string; name: string; kind: string; score: number; reason: string; footprint: number; save: number };
    const items: Item[] = [];
    for (const l of partners.lsps) {
      const reasons: string[] = [];
      let score = l.co2eTonnes; // bigger footprint → more it matters
      if (l.intensityIndex > 1.02) { reasons.push(`runs ${Math.round((l.intensityIndex - 1) * 100)}% dirtier than the average carrier`); score *= 1.6; }
      if ((l.yoyChangePct ?? 0) > 5) { reasons.push(`its volume is growing (${l.yoyChangePct}% year on year)`); score *= 1.3; }
      if (!l.greenProgram && l.co2eTonnes > 0) reasons.push('no green-fleet program yet');
      if (!reasons.length) continue;
      items.push({ id: l.id, name: l.name, kind: 'Carrier (LSP)', score, reason: reasons.join(', '), footprint: l.co2eTonnes, save: l.influenceableSavingTonnes });
    }
    for (const v of partners.vendors) {
      const reasons: string[] = [];
      let score = v.co2eTonnes * 0.9;
      if (v.controllability === 'Low') { reasons.push('hard to influence today — needs a governance conversation'); score *= 1.5; }
      else if (v.controllability === 'Medium') reasons.push('partly within our control');
      if (v.influenceableSavingTonnes > 1) reasons.push(`${formatTonnes(v.influenceableSavingTonnes)}/yr is reachable through governance`);
      if (!reasons.length) continue;
      items.push({ id: v.id, name: v.name, kind: 'Vendor', score, reason: reasons.join(', '), footprint: v.co2eTonnes, save: v.influenceableSavingTonnes });
    }
    return items.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [partners]);

  const idCell = (id: string) => (
    <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
      {id}
    </Typography>
  );

  const lspCols: Column<LspPartner>[] = [
    { key: 'id', header: 'ID', render: (l) => idCell(l.id), sortValue: (l) => l.id },
    { key: 'name', header: 'LSP', render: (l) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.name}</Typography>, sortValue: (l) => l.name },
    { key: 'operator', header: 'Operating carrier', render: (l) => <Typography variant="body2" color="text.secondary">{l.carrier}</Typography>, sortValue: (l) => l.carrier },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (l) => <strong>{formatTonnes(l.co2eTonnes)}</strong>, sortValue: (l) => l.co2eTonnes },
    {
      key: 'yoy',
      header: 'YoY',
      align: 'center',
      render: (l) =>
        l.yoyChangePct == null ? (
          <Typography variant="body2" color="text.disabled">—</Typography>
        ) : (
          <Chip size="small" variant="outlined" color={l.yoyChangePct > 5 ? 'error' : l.yoyChangePct < -5 ? 'success' : 'default'} label={`${l.yoyChangePct > 0 ? '+' : ''}${l.yoyChangePct}%`} />
        ),
      sortValue: (l) => l.yoyChangePct ?? 0,
    },
    { key: 'intensity', header: 'vs fleet', align: 'center', render: (l) => <Chip size="small" variant="outlined" color={l.intensityIndex > 1.02 ? 'error' : l.intensityIndex < 0.95 ? 'success' : 'default'} label={`${l.intensityIndex > 1 ? '+' : ''}${Math.round((l.intensityIndex - 1) * 100)}%`} />, sortValue: (l) => l.intensityIndex },
    { key: 'green', header: 'Green fleet', align: 'center', render: (l) => (l.greenProgram ? <Chip size="small" color="success" variant="outlined" label="Yes" /> : <Typography variant="body2" color="text.disabled">—</Typography>), sortValue: (l) => (l.greenProgram ? 1 : 0) },
    { key: 'infl', header: 'Save/yr', align: 'right', render: (l) => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatTonnes(l.influenceableSavingTonnes)}</span>, sortValue: (l) => l.influenceableSavingTonnes },
  ];
  const vendorCols: Column<VendorPartner>[] = [
    { key: 'id', header: 'ID', render: (v) => idCell(v.id), sortValue: (v) => v.id },
    { key: 'name', header: 'Vendor', render: (v) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.name}</Typography>, sortValue: (v) => v.name },
    { key: 'control', header: 'Control', align: 'center', render: (v) => <Chip size="small" variant="outlined" color={v.controllability === 'High' ? 'success' : v.controllability === 'Low' ? 'error' : 'warning'} label={v.controllability} />, sortValue: (v) => CONTROL_RANK[v.controllability] ?? 2 },
    { key: 'co2e', header: 'CO₂e', align: 'right', render: (v) => <strong>{formatTonnes(v.co2eTonnes)}</strong>, sortValue: (v) => v.co2eTonnes },
    { key: 'infl', header: 'Save/yr', align: 'right', render: (v) => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatTonnes(v.influenceableSavingTonnes)}</span>, sortValue: (v) => v.influenceableSavingTonnes },
  ];

  return (
    <Box>
      <PageHeader
        overline="Visibility · Partner performance"
        title="Carrier & Vendor Performance"
        subtitle="Terova outsources execution, so part of the reduction sits with partners. Track the four numbers that matter — influenceable saving, green-fleet share, weighted fleet intensity and concentration — and take the suggestions into the next tender or vendor review."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {!hasFilters ? (
        <Card>
          <EmptyState
            icon={<FilterAltRoundedIcon sx={{ fontSize: 44 }} />}
            title="Apply a filter to load partners"
            description="Pick a period, region, market, product, mode or customer above — carrier and vendor performance loads once the view is scoped."
          />
          <ScopePrompt />
        </Card>
      ) : (
      <>
      <Box sx={{ mb: 3 }}>
        {kpis ? (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
            {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
          </Box>
        ) : <KpiSkeleton count={4} />}
      </Box>

      {/* Who is who in the partner chain — reporting below follows this order */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 1.75 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            How the partner chain fits together
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            <b>Vendor / processor</b> (prepares the goods and books the origin handoff for Terova) → <b>LSP</b> (logistics service
            provider — holds Terova&apos;s freight contract and chooses the routing) → <b>Operating carrier</b> (the shipping line or
            trucking company the LSP moves the freight with). The reporting below follows that chain, top to bottom.
          </Typography>
        </CardContent>
      </Card>

      {/* Vendor governance — who controls the origin handoff */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title={`Vendor governance · ${partners?.vendors.length ?? 0}`}
          subtitle="Step 1 of the chain — vendors (processors who book the origin freight): footprint, how much Terova can influence, and the governance headroom"
          icon={<FactoryRounded sx={{ fontSize: 18 }} />}
          insights={partners ? insightsForVendors(partners.vendors) : undefined}
        >
          {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={vendorCols} rows={partners.vendors} getRowKey={(v) => v.id} initialSortKey="co2e" />}
        </ChartContainer>
      </Box>

      {/* Carrier scorecard — the league table a tender review starts from */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title={`LSP & carrier scorecard · ${partners?.lsps.length ?? 0}`}
          subtitle="Step 2 of the chain — each LSP's footprint, its operating carrier, year-over-year change, fleet intensity and what moving its volume is worth"
          icon={<LocalShippingRounded sx={{ fontSize: 18 }} />}
          insights={partners ? insightsForLsps(partners.lsps) : undefined}
        >
          {status === 'loading' || !partners ? <TableSkeleton rows={5} /> : <DataTable columns={lspCols} rows={partners.lsps} getRowKey={(l) => l.id} initialSortKey="co2e" />}
        </ChartContainer>
      </Box>

      {/* Carrier mix trend — who carries the footprint, year by year */}
      <Box sx={{ mb: 3 }}>
        <ChartContainer
          title="Carrier mix by year"
          subtitle="CO₂e per carrier, year over year — watch where the volume is drifting (month-level splits per carrier are too noisy to be useful)"
          icon={<StackedBarChartRounded sx={{ fontSize: 18 }} />}
          insights={trendInsights}
        >
          {trend ? <StackedBarTrend rows={trend.rows} series={trend.series} height={280} /> : <ChartSkeleton height={280} />}
        </ChartContainer>
      </Box>


      {/* Who needs attention — a holistic, partner-level read (not shipment by shipment) */}
      <Box>
        <ChartContainer
          title={`Partners that need attention · ${attention.length}`}
          subtitle="A whole-relationship view — which carriers and vendors to raise at the next tender or business review, and why"
          icon={<TipsAndUpdatesRounded sx={{ fontSize: 18 }} />}
        >
          {!partners ? (
            <TableSkeleton rows={3} />
          ) : attention.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No partners flagged in this scope — carrier intensity, growth and vendor control all look healthy.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {attention.map((a, i) => (
                <Stack key={a.id} direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: (t) => alpha(t.palette.warning.main, 0.14), color: 'warning.dark', fontSize: 13, fontWeight: 800 }}>
                    {i + 1}
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {a.name}
                      </Typography>
                      <Chip size="small" variant="outlined" label={a.kind} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      Carries <b>{formatTonnes(a.footprint)}</b> of CO₂e — {a.reason}.
                    </Typography>
                  </Box>
                  {a.save > 0.1 && (
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', lineHeight: 1.2 }}>
                        {formatTonnes(a.save)}/yr
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        you can influence
                      </Typography>
                    </Box>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </ChartContainer>
      </Box>
      </>
      )}
    </Box>
  );
}
