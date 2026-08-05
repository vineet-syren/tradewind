import { useMemo, useState } from 'react';
import { Box, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import ScatterPlotRounded from '@mui/icons-material/ScatterPlotRounded';
import StackedBarChartRounded from '@mui/icons-material/StackedBarChartRounded';
import TableRowsRounded from '@mui/icons-material/TableRowsRounded';
import ViewQuiltRounded from '@mui/icons-material/ViewQuiltRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { ModeStackedBar } from '@/components/charts/ModeStackedBar';
import { ScatterBubbleChart, SwatchLegend, type BubblePoint } from '@/components/charts/ScatterBubbleChart';
import { MekkoChart } from '@/components/charts/MekkoChart';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ChartSkeleton, TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModeChip } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import type { Lane } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import {
  insightsForDestModes,
  insightsForHotspots,
  insightsForLanePriority,
  insightsForLaneTable,
  insightsForRegionModes,
} from '@/utils/insights';
import { formatTonnes, formatIntensity, formatWeightTonnes, formatNumber } from '@/utils/format';

const SLICES = [
  { key: 'category', label: 'Product category', noun: 'product category' },
  { key: 'productSku', label: 'Product', noun: 'product' },
  { key: 'destPort', label: 'Destination port', noun: 'destination port' },
  { key: 'market', label: 'Market', noun: 'destination market' },
] as const;
type SliceKey = (typeof SLICES)[number]['key'];

/**
 * Product × destination lanes.
 *
 * This was "Product–Customer Lanes"; the workbook records no customer, so the
 * commercial axis is the destination port and market it actually holds.
 */
export default function ProductCustomerLanesPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes, status } = useAsync(() => ds.getLanes({ persona, filters }), [persona, filters]);
  const { data: hotspots } = useAsync(() => ds.getHotspots({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);
  const [slice, setSlice] = useState<SliceKey>('category');

  // Export lanes only — collection runs have no destination market.
  const exportLanes = useMemo(() => (lanes ?? []).filter((l) => !l.laneId.startsWith('LN-COL-')), [lanes]);

  const sliceRows = useMemo(() => {
    if (!hotspots) return [];
    switch (slice) {
      case 'productSku':
        return hotspots.byProduct;
      case 'destPort':
        return hotspots.byDestPort;
      case 'market':
        return hotspots.byMarket;
      default:
        return hotspots.byCategory;
    }
  }, [hotspots, slice]);
  const sliceMeta = SLICES.find((s) => s.key === slice)!;

  // Bubble: volume against intensity, sized by what is recoverable. The lanes
  // that sit high and right are the ones worth a conversation.
  const bubbles: BubblePoint[] = useMemo(
    () =>
      exportLanes.map((l) => ({
        name: `${l.destPort} · ${l.category}`,
        x: l.totalWeightTonnes,
        y: l.avgCo2ePerTonneKm,
        z: Math.max(l.avoidableTonnes, 0.01),
        color: MODE_COLORS[l.primaryMode] ?? '#64748b',
        meta: `${formatTonnes(l.totalCo2eTonnes)} · ${l.shipmentCount} shipments · ${formatTonnes(l.avoidableTonnes)} avoidable`,
      })),
    [exportLanes],
  );

  // Destination × mode, so the mode mix per market is visible at a glance.
  //
  // Split by where the CO₂e was actually produced, not by the lane's dominant
  // mode. Attributing a lane's whole footprint to its primary mode hid every
  // road and rail leg behind the ocean leg that outweighed them, which made the
  // road share — the part a routing decision can move — invisible.
  const destModeRows = useMemo(() => {
    const m = new Map<string, { name: string; Ocean: number; Rail: number; Road: number; Air: number }>();
    for (const l of exportLanes) {
      const r = m.get(l.destPort) ?? { name: l.destPort, Ocean: 0, Rail: 0, Road: 0, Air: 0 };
      r.Ocean += l.oceanCo2eTonnes;
      r.Rail += l.railCo2eTonnes;
      r.Road += l.roadCo2eTonnes;
      r.Air += l.airCo2eTonnes;
      m.set(l.destPort, r);
    }
    return [...m.values()].sort(
      (a, b) => b.Ocean + b.Rail + b.Road + b.Air - (a.Ocean + a.Rail + a.Road + a.Air),
    );
  }, [exportLanes]);

  const columns: Column<Lane>[] = [
    {
      key: 'lane',
      header: 'Lane',
      render: (l) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {l.origin} → {l.destPort}
        </Typography>
      ),
      sortValue: (l) => l.destPort,
    },
    { key: 'category', header: 'Product', render: (l) => l.category, sortValue: (l) => l.category },
    { key: 'market', header: 'Market', render: (l) => l.market, sortValue: (l) => l.market },
    { key: 'gateway', header: 'Gateway', render: (l) => l.gateways.join(' / ') || '—', sortValue: (l) => l.primaryGateway },
    {
      key: 'mode',
      header: 'Modes',
      // Every mode the lane actually uses, in travel order. A single chip for
      // the dominant mode read as "this lane is ocean", hiding the road and rail
      // legs that a routing decision can actually change.
      render: (l) => (
        <Stack direction="row" spacing={0.4} alignItems="center" flexWrap="wrap" useFlexGap>
          {l.modesUsed.map((m, i) => (
            <Stack key={m} direction="row" spacing={0.4} alignItems="center">
              <ModeChip mode={m} />
              {i < l.modesUsed.length - 1 && (
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 12 }}>
                  ›
                </Box>
              )}
            </Stack>
          ))}
        </Stack>
      ),
      sortValue: (l) => l.modesUsed.join('>'),
    },
    {
      key: 'shipments',
      header: 'Shipments',
      align: 'right',
      render: (l) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {l.shipmentCount}
          {l.plannedShipmentCount ? ` · ${l.plannedShipmentCount} ahead` : ''}
        </span>
      ),
      sortValue: (l) => l.shipmentCount,
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      render: (l) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatWeightTonnes(l.totalWeightTonnes)}</span>,
      sortValue: (l) => l.totalWeightTonnes,
    },
    {
      key: 'co2e',
      header: 'CO₂e',
      align: 'right',
      render: (l) => <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTonnes(l.totalCo2eTonnes)}</strong>,
      sortValue: (l) => l.totalCo2eTonnes,
    },
    {
      key: 'intensity',
      header: 'g/t·km',
      align: 'right',
      render: (l) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIntensity(l.avgCo2ePerTonneKm)}</span>,
      sortValue: (l) => l.avgCo2ePerTonneKm,
    },
    {
      key: 'avoidable',
      header: 'Avoidable',
      align: 'right',
      render: (l) =>
        l.avoidableTonnes > 0.0005 ? (
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', fontVariantNumeric: 'tabular-nums' }}>
            {formatTonnes(l.avoidableTonnes)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
      sortValue: (l) => l.avoidableTonnes,
    },
  ];

  return (
    <Box>
      <PageHeader
        overline="Understand · product & destination"
        title="Product &amp; Destination Lanes"
        subtitle="Emissions by product, destination port and market, with the lane table underneath. The workbook records no customer, so the destination is the commercial axis."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {footprint && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}>
          <KpiCard
            metric={{
              id: 'co2e',
              label: 'CO₂e in scope',
              value: footprint.totalCo2eTonnes,
              unit: 'tonnes',
              intent: 'neutral',
              hint: `${footprint.shipmentCount} movements · ${footprint.laneCount} lanes`,
              icon: 'co2e',
            }}
          />
          <KpiCard
            metric={{
              id: 'weight',
              label: 'Freight moved',
              value: footprint.totalWeightTonnes,
              unit: 'tonnes',
              display: `${formatNumber(footprint.totalWeightTonnes)} t`,
              intent: 'neutral',
              hint: 'total product weight',
              icon: 'lanes',
            }}
          />
          <KpiCard
            metric={{
              id: 'conc',
              label: 'Top-3 port share',
              value: footprint.top3DestSharePct,
              unit: 'percent',
              intent: 'neutral',
              hint: 'concentration of the footprint',
              icon: 'hotspots',
            }}
          />
          <KpiCard
            metric={{
              id: 'avoid',
              label: 'Avoidable on optimised routes',
              value: footprint.avoidableTonnes,
              unit: 'tonnes',
              intent: 'opportunity',
              hint: `${footprint.avoidablePct}% of scope`,
              icon: 'decisioning',
            }}
          />
        </Box>
      )}

      {status === 'loading' || !hotspots ? (
        <ChartSkeleton height={420} />
      ) : !exportLanes.length ? (
        <Card>
          <EmptyState
            icon={<CategoryRounded sx={{ fontSize: 44 }} />}
            title="No lanes in scope"
            description="No lane matches the current filters. Clear one to bring the network back."
          />
        </Card>
      ) : (
        <Stack spacing={3}>
          <ChartContainer
            title={`CO₂e by ${sliceMeta.noun}`}
            subtitle="Area is proportional to emissions · switch the slice to re-cut the same footprint"
            icon={<CategoryRounded sx={{ fontSize: 18 }} />}
            insights={insightsForHotspots(sliceRows, sliceMeta.noun)}
            action={
              <TextField select size="small" label="Slice by" value={slice} onChange={(e) => setSlice(e.target.value as SliceKey)} sx={{ width: 220 }}>
                {SLICES.map((s) => (
                  <MenuItem key={s.key} value={s.key}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            }
          >
            <TreemapChart
              data={sliceRows.map((r) => ({ name: r.label, size: r.co2eTonnes, sub: `${r.shipments} shipments` }))}
              valueFormatter={formatTonnes}
              height={320}
            />
          </ChartContainer>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <ChartContainer
              title="Destination × mode"
              subtitle="How each market's freight actually travels — split by the leg that produced the CO₂e"
              icon={<StackedBarChartRounded sx={{ fontSize: 18 }} />}
              insights={insightsForDestModes(destModeRows)}
              isEmpty={destModeRows.length === 0}
            >
              <ModeStackedBar rows={destModeRows} height={320} />
            </ChartContainer>

            <ChartContainer
              title="Region × mode"
              subtitle="Column width is the region's share; height is its mode mix"
              icon={<ViewQuiltRounded sx={{ fontSize: 18 }} />}
              insights={insightsForRegionModes(hotspots.regionModeMatrix)}
            >
              <MekkoChart data={hotspots.regionModeMatrix} height={320} />
            </ChartContainer>
          </Box>

          <ChartContainer
            title="Lane priority"
            subtitle="Volume against intensity, sized by what is recoverable — high and to the right is where to start"
            icon={<ScatterPlotRounded sx={{ fontSize: 18 }} />}
            insights={insightsForLanePriority(exportLanes)}
            isEmpty={bubbles.length === 0}
          >
            <ScatterBubbleChart
              points={bubbles}
              xLabel="Freight moved (t)"
              yLabel="Intensity (g CO₂e / t·km)"
              sizeLabel="Avoidable CO₂e"
              // Sub-tonne lanes are real here, and a plain tonne format renders
              // several distinct ticks as an identical "0 t".
              xFormat={(v) => formatWeightTonnes(v)}
              yFormat={(v) => formatIntensity(v)}
              height={340}
            />
            <SwatchLegend
              items={Object.entries(MODE_COLORS).map(([label, color]) => ({ label: `${label}-led`, color }))}
            />
          </ChartContainer>

          <ChartContainer
            title="All lanes"
            subtitle="Click a row to open that lane's full breakdown and optimised route"
            icon={<TableRowsRounded sx={{ fontSize: 18 }} />}
            insights={insightsForLaneTable(exportLanes)}
          >
            {!lanes ? (
              <TableSkeleton rows={8} />
            ) : (
              <DataTable
                columns={columns}
                rows={exportLanes}
                getRowKey={(l) => l.laneId}
                onRowClick={(l) => dispatch(setSelectedLane(l.laneId))}
                initialSortKey="co2e"
                maxHeight={560}
              />
            )}
          </ChartContainer>
        </Stack>
      )}
    </Box>
  );
}
