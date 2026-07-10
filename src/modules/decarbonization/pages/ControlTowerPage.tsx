import { useMemo } from 'react';
import { Box, Card } from '@mui/material';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScopePrompt } from '@/components/filters/ScopePrompt';
import { ValueHero, type HeroPart } from '@/components/cards/ValueHero';
import { ShipmentsPanel } from '@/modules/decarbonization/components/ShipmentsPanel';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { countActiveFilters } from '@/app/store/filtersSlice';
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

export default function ControlTowerPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // The tower stays empty until the user scopes it — no filters, no data pull.
  const hasFilters = countActiveFilters(filters) > 0;
  const { data: lanes } = useAsync(() => (hasFilters ? ds.getLanes({ filters }) : Promise.resolve([])), [filters]);
  const { data: recs } = useAsync(() => (hasFilters ? ds.getRecommendations({ persona, filters }) : Promise.resolve([])), [persona, filters]);

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
      {hasFilters && <ValueHero totalTonnes={hero.total} parts={hero.parts} recCount={hero.recCount} />}

      <PageHeader
        overline="Visibility · Live shipment network"
        title="Control Tower"
        subtitle="Live visibility over every shipment and route, with suggested greener options for what's still to be planned. Decisions and bookings stay in your own systems — this view shows what each option is worth."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      {!hasFilters ? (
        <Card>
          <EmptyState
            icon={<FilterAltRoundedIcon sx={{ fontSize: 44 }} />}
            title="Apply a filter to load the tower"
            description="Pick a period, region, market, product, mode or customer above — the shipment network and route suggestions load once the view is scoped."
          />
          <ScopePrompt />
        </Card>
      ) : (
        <ShipmentsPanel />
      )}
    </Box>
  );
}
