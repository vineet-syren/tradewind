/** Recompute emission hotspots from a scoped shipment set (so filters apply). */
import type {
  FlowRow,
  Hotspots,
  HotspotRow,
  Lane,
  MonthModeRow,
  RegionModeRow,
  Shipment,
  ShipmentFilters,
} from '@/types';

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
  const m = new Map<string, {
    key: string; label: string; co2e: number; weight: number;
    tonneKm: number; shipments: number; avoidable: number;
  }>();
  for (const s of shipments) {
    const k = keyFn(s);
    const g = m.get(k) ?? { key: k, label: labelFn(s), co2e: 0, weight: 0, tonneKm: 0, shipments: 0, avoidable: 0 };
    g.co2e += s.co2eTonnes;
    g.weight += s.weightTonnes;
    g.tonneKm += s.weightTonnes * s.totalDistanceKm;
    g.avoidable += s.avoidableTonnes;
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
      co2ePerTonneKm: round((g.co2e * 1e6) / Math.max(g.tonneKm, 0.001), 1),
      avoidableTonnes: round(g.avoidable),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes)
    .slice(0, limit);
}

/** Destination regions broken down by transport mode (CO₂e) — heatmap input. */
function regionModeMatrix(shipments: Shipment[]): RegionModeRow[] {
  const m = new Map<string, RegionModeRow>();
  for (const s of shipments) {
    const r = m.get(s.region) ?? { region: s.region, Ocean: 0, Rail: 0, Road: 0, Air: 0, total: 0 };
    r[s.primaryMode] = round(r[s.primaryMode] + s.co2eTonnes);
    r.total = round(r.total + s.co2eTonnes);
    m.set(s.region, r);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Two-stage CO₂e flow links (gateway → mode, mode → region) for sankey views. */
function emissionFlows(shipments: Shipment[]): FlowRow[] {
  const stage1 = new Map<string, number>();
  const stage2 = new Map<string, number>();
  for (const s of shipments) {
    const gateway = s.gateway ?? (s.isAirFreight ? 'Flown out' : 'Inland only');
    const k1 = `${gateway}→${s.primaryMode}`;
    const k2 = `${s.primaryMode}→${s.region}`;
    stage1.set(k1, (stage1.get(k1) ?? 0) + s.co2eTonnes);
    stage2.set(k2, (stage2.get(k2) ?? 0) + s.co2eTonnes);
  }
  const toRows = (m: Map<string, number>): FlowRow[] =>
    [...m.entries()].map(([k, v]) => {
      const [from, to] = k.split('→');
      return { from, to, value: round(v) };
    });
  return [...toRows(stage1), ...toRows(stage2)].filter((f) => f.value > 0).sort((a, b) => b.value - a.value);
}

/** Monthly CO₂e split by mode (for a stacked-area trend). */
function monthlyByMode(shipments: Shipment[]): MonthModeRow[] {
  const m = new Map<string, MonthModeRow>();
  for (const s of shipments) {
    const r = m.get(s.period) ?? { period: s.period, Ocean: 0, Rail: 0, Road: 0, Air: 0 };
    r[s.primaryMode] = round(r[s.primaryMode] + s.co2eTonnes);
    m.set(s.period, r);
  }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function buildHotspots(shipments: Shipment[]): Hotspots {
  const exports = shipments.filter((s) => s.stream === 'export');
  const collection = shipments.filter((s) => s.stream === 'collection');
  return {
    byCategory: topGroups(exports, (s) => s.category, (s) => s.category),
    byMarket: topGroups(exports, (s) => s.market, (s) => s.market),
    byMode: topGroups(exports, (s) => s.primaryMode, (s) => `${s.primaryMode}-led`),
    byGateway: topGroups(exports, (s) => s.gateway ?? 'Flown out', (s) => s.gateway ?? 'Flown out'),
    byDestPort: topGroups(exports, (s) => s.destPort, (s) => `${s.destPort}, ${s.destCountry}`),
    byProduct: topGroups(exports, (s) => s.productSku, (s) => s.productName, 10),
    byCollectionOrigin: topGroups(collection, (s) => s.origin, (s) => s.origin),
    monthlyByMode: monthlyByMode(exports),
    regionModeMatrix: regionModeMatrix(exports),
    flows: emissionFlows(exports),
  };
}

/** Filter lanes by the shipment-style filters (dates don't apply to lanes). */
export function filterLanes(lanes: Lane[], f?: ShipmentFilters): Lane[] {
  if (!f) return lanes;
  const inSet = (v: string, arr?: string[]) => !arr?.length || arr.includes(v);
  const search = f.search?.trim().toLowerCase();
  return lanes.filter(
    (l) =>
      inSet(l.region, f.regions) &&
      inSet(l.market, f.markets) &&
      inSet(l.category, f.categories) &&
      inSet(l.destPort, f.destPorts) &&
      (!f.gateways?.length || l.gateways.some((g) => f.gateways!.includes(g))) &&
      (!search ||
        l.label.toLowerCase().includes(search) ||
        l.category.toLowerCase().includes(search) ||
        l.origin.toLowerCase().includes(search) ||
        l.destPort.toLowerCase().includes(search) ||
        l.market.toLowerCase().includes(search)),
  );
}
