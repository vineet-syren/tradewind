import { useMemo } from 'react';
import { Box } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { ValueHero, type HeroPart } from '@/components/cards/ValueHero';
import { ShipmentsPanel } from '@/modules/decarbonization/components/ShipmentsPanel';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppSelector } from '@/app/store/hooks';
import { TYPE_META } from '@/constants/actionTypes';
import type { ActionType } from '@/types';

/**
 * The operational hub: network map, full shipment register, and the route
 * options for whatever is selected.
 *
 * It loads unscoped on purpose. The previous build gated everything behind
 * "apply a filter first", which meant arriving at an empty screen; the filter
 * bar is still here to narrow, but nothing waits on it.
 */
export default function ControlTowerPage() {
  const ds = useDataSource();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  // Recorded shipments only. The hero is the headline claim about the network —
  // "this is what your own history shows was on the table" — so it is pinned to
  // freight that actually moved and stays there even when the page is filtered
  // to the forward book. The forward book has its own numbers, on the shipments
  // it belongs to.
  const { data: recs } = useAsync(
    () => ds.getRecommendations({ persona, filters, shippedOnly: true }),
    [persona, filters],
  );

  const hero = useMemo(() => {
    const open = recs ?? [];
    const byType = new Map<ActionType, { tonnes: number; ships: Set<string> }>();
    for (const r of open) {
      const g = byType.get(r.type) ?? { tonnes: 0, ships: new Set<string>() };
      g.tonnes += r.estCo2eSavingTonnes;
      if (r.shipmentId) g.ships.add(r.shipmentId);
      byType.set(r.type, g);
    }
    // Real per-type totals — the previous build split one number by an
    // allocation estimate, which it had to disclaim. This is measured.
    const parts: HeroPart[] = [...byType.entries()]
      .sort((a, b) => b[1].tonnes - a[1].tonnes)
      .slice(0, 4)
      .map(([t, g]) => ({ label: (TYPE_META[t]?.label ?? t).toLowerCase(), tonnes: g.tonnes }));
    return {
      total: open.reduce((s, r) => s + r.estCo2eSavingTonnes, 0),
      parts,
      recCount: open.length,
      shipmentCount: new Set(open.map((r) => r.shipmentId).filter(Boolean)).size,
    };
  }, [recs]);

  return (
    <Box>
      <ValueHero totalTonnes={hero.total} parts={hero.parts} recCount={hero.recCount} shipmentCount={hero.shipmentCount} />

      <PageHeader
        overline="Visibility · Shipment network"
        title="Control Tower"
        subtitle="Every shipment and route the workbook records, with the greener options it proves were available. Decisions and bookings stay in your own systems — this view shows what each option is worth, and the source cell behind every figure."
        actions={<ScopeNote />}
      />
      <FilterPanel />

      <ShipmentsPanel />
    </Box>
  );
}
