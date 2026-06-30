/**
 * Build the downstream-transportation footprint for a scoped shipment set.
 * This is the equivalent of a server-side aggregate endpoint — all maths run
 * here, never in the components.
 */
import type {
  Assumptions,
  Footprint,
  Lane,
  ModeLabel,
  ModeSplitRow,
  NamedShare,
  Shipment,
  YearPoint,
} from '@/types';

const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const MODES: ModeLabel[] = ['Ocean', 'Rail', 'Road', 'Air'];

export function buildFootprint(
  shipments: Shipment[],
  lanes: Lane[],
  assumptions: Assumptions,
): Footprint {
  const totalCo2eTonnes = shipments.reduce((s, x) => s + x.co2eTonnes, 0);
  const totalWeightTonnes = shipments.reduce((s, x) => s + x.weightTonnes, 0);
  // Annualize by the actual month span (handles partial latest year correctly).
  const months = new Set(shipments.map((s) => s.period));
  const yearsCovered = Math.max(1, months.size / 12);
  const annualCo2eTonnes = totalCo2eTonnes / yearsCovered;

  // Mode split by the shipment's primary mode (Ocean-led vs Air exception).
  const modeAgg = new Map<ModeLabel, { co2e: number; ships: number }>();
  for (const s of shipments) {
    const k = s.primaryMode;
    const g = modeAgg.get(k) ?? { co2e: 0, ships: 0 };
    g.co2e += s.co2eTonnes;
    g.ships += 1;
    modeAgg.set(k, g);
  }
  const modeSplit: ModeSplitRow[] = MODES.filter((m) => modeAgg.has(m)).map((m) => {
    const g = modeAgg.get(m)!;
    return { mode: m, co2eTonnes: round(g.co2e, 2), pct: round((g.co2e / Math.max(totalCo2eTonnes, 0.001)) * 100, 1), shipments: g.ships };
  });

  // Year-over-year (CO₂e + intensity per calendar year).
  const yearAgg = new Map<number, { co2e: number; weight: number }>();
  for (const s of shipments) {
    const g = yearAgg.get(s.year) ?? { co2e: 0, weight: 0 };
    g.co2e += s.co2eTonnes;
    g.weight += s.weightTonnes;
    yearAgg.set(s.year, g);
  }
  const byYear: YearPoint[] = [...yearAgg.entries()]
    .map(([year, g]) => ({ year, co2eTonnes: round(g.co2e, 1), weightTonnes: round(g.weight, 1), intensity: round(g.co2e / Math.max(g.weight, 0.001), 3) }))
    .sort((a, b) => a.year - b.year);

  // By destination region.
  const regionAgg = new Map<string, number>();
  for (const s of shipments) regionAgg.set(s.region, (regionAgg.get(s.region) ?? 0) + s.co2eTonnes);
  const byRegion: NamedShare[] = [...regionAgg.entries()]
    .map(([label, co2e]) => ({ label, co2eTonnes: round(co2e, 2), pct: round((co2e / Math.max(totalCo2eTonnes, 0.001)) * 100, 1) }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);

  // Customer concentration (top 5 share).
  const custAgg = new Map<string, number>();
  for (const s of shipments) custAgg.set(s.customer, (custAgg.get(s.customer) ?? 0) + s.co2eTonnes);
  const top5 = [...custAgg.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const top5CustomerSharePct = round((top5 / Math.max(totalCo2eTonnes, 0.001)) * 100, 0);

  // Realized reduction (weighted): reconstruct gross from net + realized %.
  let gross = 0;
  for (const s of shipments) gross += s.co2eTonnes / (1 - s.realizedReductionPct / 100);
  const avoided = gross - totalCo2eTonnes;
  const realizedReductionPct = round((avoided / Math.max(gross, 0.001)) * 100, 1);

  // Reduction opportunity — scope lanes to those touched by the shipment set.
  const laneIds = new Set(shipments.map((s) => s.laneId));
  const scopedLanes = lanes.filter((l) => laneIds.has(l.laneId));
  const reductionOpportunityTonnes = round(scopedLanes.reduce((s, l) => s + l.realizableReductionTonnes, 0), 1);
  const theoreticalReductionTonnes = round(scopedLanes.reduce((s, l) => s + l.reductionPotentialTonnes, 0), 1);
  const reductionOpportunityPct = round((reductionOpportunityTonnes / Math.max(annualCo2eTonnes, 0.001)) * 100, 1);

  const airShipments = shipments.filter((s) => s.airException);

  return {
    totalCo2eTonnes: round(totalCo2eTonnes, 1),
    annualCo2eTonnes: round(annualCo2eTonnes, 1),
    totalWeightTonnes: round(totalWeightTonnes, 1),
    avgIntensity: round(totalCo2eTonnes / Math.max(totalWeightTonnes, 0.001), 3),
    shipmentCount: shipments.length,
    laneCount: scopedLanes.length,
    modeSplit,
    byRegion,
    byYear,
    reductionOpportunityTonnes,
    reductionOpportunityPct,
    theoreticalReductionTonnes,
    realizedReductionPct,
    ambitionPct: assumptions.ambitionPct,
    airExceptionCount: airShipments.length,
    airAvoidableCount: airShipments.filter((s) => s.airAvoidable === true).length,
    airCo2eTonnes: round(airShipments.reduce((s, x) => s + x.co2eTonnes, 0), 2),
    liveShipmentCount: shipments.filter((s) => s.status === 'In transit' || s.status === 'Planned').length,
    topLanes: [...scopedLanes].sort((a, b) => b.realizableReductionTonnes - a.realizableReductionTonnes).slice(0, 6),
    top5CustomerSharePct,
  };
}
