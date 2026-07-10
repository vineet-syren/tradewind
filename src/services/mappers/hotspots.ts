/** Recompute emission hotspots from a scoped shipment set (so filters apply). */
import type { CustomerModeRow, FlowRow, Hotspots, HotspotRow, Lane, MonthModeRow, RegionModeRow, Shipment, ShipmentFilters } from '@/types';

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
  const m = new Map<string, { key: string; label: string; co2e: number; weight: number; tonKm: number; shipments: number }>();
  for (const s of shipments) {
    const k = keyFn(s);
    const g = m.get(k) ?? { key: k, label: labelFn(s), co2e: 0, weight: 0, tonKm: 0, shipments: 0 };
    g.co2e += s.co2eTonnes;
    g.weight += s.weightTonnes;
    g.tonKm += s.weightTonnes * s.totalDistanceKm;
    g.shipments += 1;
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({
      key: g.key,
      label: g.label,
      co2eTonnes: round(g.co2e),
      weightTonnes: round(g.weight),
      shipments: g.shipments,
      co2ePerTonne: round(g.co2e / Math.max(g.weight, 0.001), 3),
      co2ePerTonneKm: round((g.co2e * 1e6) / Math.max(g.tonKm, 0.001), 1),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes)
    .slice(0, limit);
}

/** Top-N customers broken down by transport mode (CO₂e), for stacked bars. */
function customerModeMatrix(shipments: Shipment[], limit = 8): CustomerModeRow[] {
  const m = new Map<string, CustomerModeRow>();
  for (const s of shipments) {
    const r = m.get(s.customer) ?? { customer: s.customer, Ocean: 0, Rail: 0, Road: 0, Air: 0, total: 0 };
    r[s.primaryMode] = round(r[s.primaryMode] + s.co2eTonnes, 2);
    r.total = round(r.total + s.co2eTonnes, 2);
    m.set(s.customer, r);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/** Destination regions broken down by transport mode (CO₂e) — mekko/heatmap input. */
function regionModeMatrix(shipments: Shipment[]): RegionModeRow[] {
  const m = new Map<string, RegionModeRow>();
  for (const s of shipments) {
    const r = m.get(s.region) ?? { region: s.region, Ocean: 0, Rail: 0, Road: 0, Air: 0, total: 0 };
    r[s.primaryMode] = round(r[s.primaryMode] + s.co2eTonnes, 2);
    r.total = round(r.total + s.co2eTonnes, 2);
    m.set(s.region, r);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Two-stage CO₂e flow links (origin → mode, mode → destination region) for sankey views. */
function emissionFlows(shipments: Shipment[], originLimit = 6): FlowRow[] {
  const originTotals = new Map<string, number>();
  for (const s of shipments) originTotals.set(s.origin, (originTotals.get(s.origin) ?? 0) + s.co2eTonnes);
  const keptOrigins = new Set(
    [...originTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, originLimit).map(([k]) => k),
  );
  const stage1 = new Map<string, number>();
  const stage2 = new Map<string, number>();
  for (const s of shipments) {
    const origin = keptOrigins.has(s.origin) ? s.origin : 'Other origins';
    const k1 = `${origin}→${s.primaryMode}`;
    const k2 = `${s.primaryMode}→${s.region}`;
    stage1.set(k1, (stage1.get(k1) ?? 0) + s.co2eTonnes);
    stage2.set(k2, (stage2.get(k2) ?? 0) + s.co2eTonnes);
  }
  const toRows = (m: Map<string, number>): FlowRow[] =>
    [...m.entries()].map(([k, v]) => {
      const [from, to] = k.split('→');
      return { from, to, value: round(v, 2) };
    });
  return [...toRows(stage1), ...toRows(stage2)].filter((f) => f.value > 0).sort((a, b) => b.value - a.value);
}

/** Monthly CO₂e split by mode (for a stacked-area trend). */
function monthlyByMode(shipments: Shipment[]): MonthModeRow[] {
  const m = new Map<string, MonthModeRow>();
  for (const s of shipments) {
    const r = m.get(s.period) ?? { period: s.period, Ocean: 0, Rail: 0, Road: 0, Air: 0 };
    r[s.primaryMode] = round(r[s.primaryMode] + s.co2eTonnes, 2);
    m.set(s.period, r);
  }
  return [...m.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
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
    customerModeMatrix: customerModeMatrix(shipments),
    monthlyByMode: monthlyByMode(shipments),
    regionModeMatrix: regionModeMatrix(shipments),
    flows: emissionFlows(shipments),
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
