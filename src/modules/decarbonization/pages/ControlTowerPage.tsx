import { useMemo, useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import RouteRounded from '@mui/icons-material/RouteRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ValueHero, type HeroPart } from '@/components/cards/ValueHero';
import { ShipmentsPanel } from '@/modules/decarbonization/components/ShipmentsPanel';
import { ReducePanel } from '@/modules/decarbonization/components/ReducePanel';
import { ActionsPanel } from '@/modules/decarbonization/components/ActionsPanel';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import type { ActionType } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  'mode-shift': 'mode shift',
  'air-avoidance': 'air-freight avoidance',
  'consolidation': 'consolidation',
  'route-swap': 'route optimization',
  'origin-port': 'greener gateways',
  'lsp-swap': 'carrier switches',
  'vendor-intervention': 'vendor governance',
};

type HubTab = 'shipments' | 'reduce' | 'actions';

export default function ControlTowerPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { data: lanes } = useAsync(() => ds.getLanes({ filters }), [filters]);
  const { data: recs } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);
  const [tab, setTab] = useState<HubTab>('shipments');

  const hero = useMemo(() => {
    const open = recs ?? [];
    const total = (lanes ?? []).reduce((s, l) => s + l.realizableReductionTonnes, 0);
    const recTotal = open.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
    const byType = new Map<ActionType, number>();
    for (const r of open) byType.set(r.type, (byType.get(r.type) ?? 0) + r.estCo2eSavingTonnes);
    const parts: HeroPart[] = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, v]) => ({ label: TYPE_LABEL[t] ?? t, tonnes: recTotal > 0 ? (v / recTotal) * total : 0 }));
    return { total, parts, recCount: open.length };
  }, [lanes, recs]);

  return (
    <Box>
      {/* Change 2 — value-on-the-table hero sits above everything */}
      <ValueHero totalTonnes={hero.total} parts={hero.parts} recCount={hero.recCount} />

      <PageHeader
        overline="Operate · Decarbonization Control Tower"
        title="Control Tower"
        subtitle="One place to see every shipment, decide its route, work the reduction backlog and track what's been actioned — visibility, decisioning and execution together."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as HubTab)}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 } }}
      >
        <Tab value="shipments" icon={<RouteRounded sx={{ fontSize: 18 }} />} iconPosition="start" label="Shipments & routes" />
        <Tab value="reduce" icon={<BoltRounded sx={{ fontSize: 18 }} />} iconPosition="start" label="Reduce & plan" />
        <Tab value="actions" icon={<FactCheckRounded sx={{ fontSize: 18 }} />} iconPosition="start" label="Action tracker" />
      </Tabs>

      {tab === 'shipments' && <ShipmentsPanel />}
      {tab === 'reduce' && <ReducePanel />}
      {tab === 'actions' && <ActionsPanel />}
    </Box>
  );
}
