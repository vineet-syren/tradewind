/** Recompute emission hotspots from a scoped shipment set (so filters apply). */
import type { Hotspots, HotspotRow, Lane, Shipment, ShipmentFilters } from '@/types';

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function topGroups(
  shipments: Shipment[],
  keyFn: (s: Shipment) => string,
  labelFn: (s: Shipment) => string,
  limit = 8,
): HotspotRow[] {
  const m = new Map<string, HotspotRow>();
  for (const s of shipments) {
    const k = keyFn(s);
    const g = m.get(k) ?? { key: k, label: labelFn(s), co2eTonnes: 0, weightTonnes: 0, shipments: 0, co2ePerTonne: 0 };
    g.co2eTonnes += s.co2eTonnes;
    g.weightTonnes += s.weightTonnes;
    g.shipments += 1;
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({
      ...g,
      co2eTonnes: round(g.co2eTonnes),
      weightTonnes: round(g.weightTonnes),
      co2ePerTonne: round(g.co2eTonnes / Math.max(g.weightTonnes, 0.001), 3),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes)
    .slice(0, limit);
}

export function buildHotspots(shipments: Shipment[]): Hotspots {
  return {
    byProductCategory: topGroups(shipments, (s) => s.category, (s) => s.category),
    byCustomer: topGroups(shipments, (s) => s.customer, (s) => s.customer),
    byMarket: topGroups(shipments, (s) => s.market, (s) => s.market),
    byMode: topGroups(shipments, (s) => s.primaryMode, (s) => `${s.primaryMode}-led`),
    byOriginPort: topGroups(shipments, (s) => s.originPort, (s) => s.originPort),
    byDestPort: topGroups(shipments, (s) => s.destPort, (s) => s.destPort),
    byVendor: topGroups(shipments, (s) => s.vendor, (s) => s.vendor),
    byLsp: topGroups(shipments, (s) => s.lsp, (s) => s.lsp),
    byOrigin: topGroups(shipments, (s) => s.origin, (s) => `${s.origin}, ${s.originState}`),
  };
}

/** Filter lanes by the shipment-style filters (years don't apply to lanes). */
export function filterLanes(lanes: Lane[], f?: ShipmentFilters): Lane[] {
  if (!f) return lanes;
  const inSet = (v: string, arr?: string[]) => !arr?.length || arr.includes(v);
  const search = f.search?.trim().toLowerCase();
  return lanes.filter(
    (l) =>
      inSet(l.region, f.regions) &&
      inSet(l.market, f.markets) &&
      inSet(l.productCategory, f.productCategories) &&
      inSet(l.customer, f.customers) &&
      inSet(l.vendor, f.vendors) &&
      inSet(l.lsp, f.lsps) &&
      inSet(l.originPort, f.originPorts) &&
      (!search ||
        l.label.toLowerCase().includes(search) ||
        l.customer.toLowerCase().includes(search) ||
        l.origin.toLowerCase().includes(search) ||
        l.destPort.toLowerCase().includes(search)),
  );
}
